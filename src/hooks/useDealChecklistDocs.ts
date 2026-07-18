import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressIfImage } from '@/lib/compressFile';
import type { ChecklistStep } from '@/lib/dealdesk/types';
import type { DealChecklistSectionKey } from '@/hooks/useDocumentSettings';

// Checklist files live in the existing private documents bucket, mirroring the
// vehicle stock-docs upload pattern (compress images → upload → store file_path).
const DOCUMENTS_BUCKET = 'documents';

/** One per-deal checklist item state row (deal_checklist_docs). Items themselves
 *  are config-driven (document_settings.dealChecklistConfig); rows are created
 *  lazily on first status change / upload. */
export interface DealChecklistDoc {
  id: string;
  deal_id: string;
  section: string;
  item_key: string;
  status: ChecklistStep;
  file_path: string | null;
  file_name: string | null;
  updated_by: string | null;
  updated_at: string;
}

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);

const docsKey = (dealId?: string | null) => ['deal-checklist-docs', dealId ?? null];

/** All checklist state rows for a deal. Config items without a row simply have
 *  no entry here — callers treat that as status 'not_started', no file. */
export const useDealChecklistDocs = (dealId?: string | null) => {
  return useQuery({
    queryKey: docsKey(dealId),
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deal_checklist_docs')
        .select('*')
        .eq('deal_id', dealId);
      if (error) throw error;
      return (data || []) as DealChecklistDoc[];
    },
  });
};

/** Find the state row for one config item, if any. */
export const findChecklistDoc = (
  docs: DealChecklistDoc[] | undefined,
  section: DealChecklistSectionKey,
  itemKey: string,
): DealChecklistDoc | undefined =>
  (docs || []).find((d) => d.section === section && d.item_key === itemKey);

interface UpsertArgs {
  dealId: string;
  section: DealChecklistSectionKey;
  itemKey: string;
  status?: ChecklistStep;
  filePath?: string | null;
  fileName?: string | null;
}

/** Upsert one item's status / file info (keyed by deal_id + section + item_key). */
export const useUpsertDealChecklistDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpsertArgs) => {
      const { data: auth } = await supabase.auth.getUser();
      const payload: Record<string, unknown> = {
        deal_id: args.dealId,
        section: args.section,
        item_key: args.itemKey,
        updated_by: auth?.user?.id ?? null,
      };
      if (args.status !== undefined) payload.status = args.status;
      if (args.filePath !== undefined) payload.file_path = args.filePath;
      if (args.fileName !== undefined) payload.file_name = args.fileName;

      const { data, error } = await (supabase as any)
        .from('deal_checklist_docs')
        .upsert(payload, { onConflict: 'deal_id,section,item_key' })
        .select()
        .single();
      if (error) throw error;
      return data as DealChecklistDoc;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: docsKey(vars.dealId) });
    },
    onError: (error: any) => {
      console.error('Deal checklist update failed:', error);
      toast.error('Could not update checklist item');
    },
  });
};

interface UploadArgs {
  dealId: string;
  section: DealChecklistSectionKey;
  itemKey: string;
  file: File;
}

/** Compress (images) → upload to the documents bucket → attach to the item and
 *  mark it 'done'. Rolls the storage object back if the row write fails. */
export const useUploadDealChecklistDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UploadArgs) => {
      const compressed = await compressIfImage(args.file, 'balanced');
      const path = `deal/${args.dealId}/checklist/${args.section}/${args.itemKey}/${Date.now()}-${sanitizeName(compressed.name)}`;

      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
      if (upErr) throw upErr;

      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from('deal_checklist_docs')
        .upsert(
          {
            deal_id: args.dealId,
            section: args.section,
            item_key: args.itemKey,
            status: 'done',
            file_path: path,
            file_name: args.file.name,
            updated_by: auth?.user?.id ?? null,
          },
          { onConflict: 'deal_id,section,item_key' },
        )
        .select()
        .single();

      if (error) {
        // Roll back the orphaned storage object if the row write failed.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        throw error;
      }
      return data as DealChecklistDoc;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: docsKey(vars.dealId) });
      toast.success('Document uploaded');
    },
    onError: (error: any) => {
      console.error('Deal checklist upload failed:', error);
      toast.error('Upload failed: ' + (error?.message || 'unknown error'));
    },
  });
};

/** Signed URL to view/download an uploaded checklist document. */
export const getDealChecklistDocUrl = async (filePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (error) {
    toast.error('Could not open document');
    return null;
  }
  return data?.signedUrl ?? null;
};
