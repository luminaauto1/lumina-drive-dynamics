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
const filesKey = (dealId?: string | null) => ['deal-checklist-files', dealId ?? null];

/** One attached document. An item can hold MANY (deal_checklist_files); the
 *  status still lives on the single deal_checklist_docs row. */
export interface DealChecklistFile {
  id: string;
  deal_id: string;
  section: string;
  item_key: string;
  file_path: string;
  file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Every attached file for a deal, oldest first. */
export const useDealChecklistFiles = (dealId?: string | null) =>
  useQuery({
    queryKey: filesKey(dealId),
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deal_checklist_files')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as DealChecklistFile[];
    },
  });

/** The files attached to one config item. */
export const filesForItem = (
  files: DealChecklistFile[] | undefined,
  section: DealChecklistSectionKey,
  itemKey: string,
): DealChecklistFile[] =>
  (files || []).filter((f) => f.section === section && f.item_key === itemKey);

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
  /** One or many — an item can hold a whole set of documents. */
  files: File[];
}

/** Compress (images) → upload each file → ADD them to the item (never replacing
 *  what is already there) and mark the item 'done'. Any storage object whose row
 *  write fails is rolled back so nothing is orphaned. */
export const useUploadDealChecklistDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UploadArgs) => {
      const { data: auth } = await supabase.auth.getUser();
      const uploaded: { path: string; name: string }[] = [];
      const failed: string[] = [];

      for (const file of args.files) {
        const compressed = await compressIfImage(file, 'balanced');
        const path = `deal/${args.dealId}/checklist/${args.section}/${args.itemKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeName(compressed.name)}`;
        const { error: upErr } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
        if (upErr) { failed.push(file.name); continue; }

        const { error: rowErr } = await (supabase as any)
          .from('deal_checklist_files')
          .insert({
            deal_id: args.dealId,
            section: args.section,
            item_key: args.itemKey,
            file_path: path,
            file_name: file.name,
            uploaded_by: auth?.user?.id ?? null,
          });
        if (rowErr) {
          await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
          failed.push(file.name);
          continue;
        }
        uploaded.push({ path, name: file.name });
      }

      // First successful attachment flips the item to done; the status row also
      // keeps the newest path so older readers of file_path still resolve.
      if (uploaded.length > 0) {
        const newest = uploaded[uploaded.length - 1];
        await (supabase as any)
          .from('deal_checklist_docs')
          .upsert(
            {
              deal_id: args.dealId,
              section: args.section,
              item_key: args.itemKey,
              status: 'done',
              file_path: newest.path,
              file_name: newest.name,
              updated_by: auth?.user?.id ?? null,
            },
            { onConflict: 'deal_id,section,item_key' },
          );
      }
      if (uploaded.length === 0) throw new Error(`Could not upload ${failed.join(', ')}`);
      return { uploaded: uploaded.length, failed };
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: docsKey(vars.dealId) });
      queryClient.invalidateQueries({ queryKey: filesKey(vars.dealId) });
      toast.success(`${res.uploaded} document${res.uploaded === 1 ? '' : 's'} uploaded`);
      if (res.failed.length) toast.error(`Failed: ${res.failed.join(', ')}`);
    },
    onError: (error: any) => {
      console.error('Deal checklist upload failed:', error);
      toast.error('Upload failed: ' + (error?.message || 'unknown error'));
    },
  });
};

/** Detach one document: remove the row, then the storage object. */
export const useDeleteDealChecklistFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: DealChecklistFile) => {
      const { error } = await (supabase as any)
        .from('deal_checklist_files').delete().eq('id', file.id);
      if (error) throw error;
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([file.file_path]).catch(() => {});
      return file;
    },
    onSuccess: (file) => {
      queryClient.invalidateQueries({ queryKey: filesKey(file.deal_id) });
      queryClient.invalidateQueries({ queryKey: docsKey(file.deal_id) });
      toast.success('Document removed');
    },
    onError: (error: any) => toast.error('Could not remove: ' + (error?.message || 'unknown error')),
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
