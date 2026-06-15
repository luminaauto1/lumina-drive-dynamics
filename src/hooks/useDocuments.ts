import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressIfImage, CompressionLevel } from '@/lib/compressFile';

export type DocCategory = 'client' | 'vehicle' | 'deal' | 'business';

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  client: 'Client documents',
  vehicle: 'Vehicle docs',
  deal: 'Deal & contracts',
  business: 'Business docs',
};

export const DOC_CATEGORIES: DocCategory[] = ['client', 'vehicle', 'deal', 'business'];

// Default storage allowance for the dashboard meter. Supabase Pro includes
// 100 GB; change this single value if the plan changes.
export const STORAGE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024;

const DOCUMENTS_BUCKET = 'documents';

export interface DocRecord {
  id: string;
  title: string;
  file_path: string;
  bucket: string;
  category: DocCategory;
  doc_type: string | null;
  mime_type: string | null;
  file_size: number;
  client_id: string | null;
  application_id: string | null;
  vehicle_id: string | null;
  deal_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocFilters {
  category?: DocCategory;
  clientId?: string;
  applicationId?: string;
  vehicleId?: string;
  dealId?: string;
}

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);

// Build the react-query key from filters so each scope caches independently.
const docsKey = (f: DocFilters) => ['documents', f.category ?? null, f.clientId ?? null, f.applicationId ?? null, f.vehicleId ?? null, f.dealId ?? null];

// A scope is "empty" when it has no category and no entity link — used to avoid
// firing entity-scoped queries before an id is known.
const hasScope = (f: DocFilters) =>
  !!(f.category || f.clientId || f.applicationId || f.vehicleId || f.dealId);

/** List documents matching a scope: same category AND linked to ANY provided entity. */
export const useDocuments = (filters: DocFilters = {}, opts: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: docsKey(filters),
    queryFn: async () => {
      let q = (supabase as any).from('documents').select('*');
      if (filters.category) q = q.eq('category', filters.category);

      const ors: string[] = [];
      if (filters.clientId) ors.push(`client_id.eq.${filters.clientId}`);
      if (filters.applicationId) ors.push(`application_id.eq.${filters.applicationId}`);
      if (filters.vehicleId) ors.push(`vehicle_id.eq.${filters.vehicleId}`);
      if (filters.dealId) ors.push(`deal_id.eq.${filters.dealId}`);
      if (ors.length) q = q.or(ors.join(','));

      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DocRecord[];
    },
    enabled: opts.enabled ?? true,
  });
};

/** Dashboard stats from the documents table: total + per-category counts and sizes. */
export const useDocumentStats = () => {
  return useQuery({
    queryKey: ['documents', 'stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('documents')
        .select('category, file_size');
      if (error) throw error;
      const rows = (data || []) as { category: DocCategory; file_size: number }[];

      const byCategory: Record<DocCategory, { count: number; bytes: number }> = {
        client: { count: 0, bytes: 0 },
        vehicle: { count: 0, bytes: 0 },
        deal: { count: 0, bytes: 0 },
        business: { count: 0, bytes: 0 },
      };
      let totalCount = 0;
      let totalBytes = 0;
      for (const r of rows) {
        totalCount += 1;
        totalBytes += r.file_size || 0;
        if (byCategory[r.category]) {
          byCategory[r.category].count += 1;
          byCategory[r.category].bytes += r.file_size || 0;
        }
      }
      return { totalCount, totalBytes, byCategory };
    },
  });
};

/** Live Supabase Storage usage (all buckets) via the get_storage_stats RPC. */
export const useStorageStats = () => {
  return useQuery({
    queryKey: ['storage-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_storage_stats');
      if (error) throw error;
      return data as {
        total_bytes: number;
        total_files: number;
        by_bucket: Record<string, { bytes: number; files: number }>;
      };
    },
  });
};

interface UploadArgs {
  file: File;
  category: DocCategory;
  docType?: string;
  clientId?: string;
  applicationId?: string;
  vehicleId?: string;
  dealId?: string;
  compression?: CompressionLevel;
}

/** Compress (images) → upload to the documents bucket → record metadata row. */
export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UploadArgs) => {
      const compressed = await compressIfImage(args.file, args.compression ?? 'balanced');

      // entity folder keeps the bucket tidy & makes per-entity cleanup easy.
      const entity =
        args.vehicleId || args.applicationId || args.clientId || args.dealId || 'general';
      const path = `${args.category}/${entity}/${Date.now()}-${sanitizeName(compressed.name)}`;

      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('documents')
        .insert({
          title: args.file.name,
          file_path: path,
          bucket: DOCUMENTS_BUCKET,
          category: args.category,
          doc_type: args.docType || null,
          mime_type: compressed.type || null,
          file_size: compressed.size,
          client_id: args.clientId || null,
          application_id: args.applicationId || null,
          vehicle_id: args.vehicleId || null,
          deal_id: args.dealId || null,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        // Roll back the orphaned storage object if the metadata insert failed.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        throw error;
      }
      return data as DocRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
    onError: (error: any) => {
      console.error('Document upload failed:', error);
      toast.error('Upload failed: ' + (error?.message || 'unknown error'));
    },
  });
};

/** Delete a document: remove the storage object then the metadata row. */
export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doc: DocRecord) => {
      await supabase.storage.from(doc.bucket || DOCUMENTS_BUCKET).remove([doc.file_path]);
      const { error } = await (supabase as any).from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
      toast.success('Document deleted');
    },
    onError: (error: any) => {
      console.error('Delete failed:', error);
      toast.error('Could not delete document');
    },
  });
};

/** Create a short-lived signed URL to view/download a private document. */
export const getDocumentUrl = async (doc: DocRecord): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(doc.bucket || DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_path, 60 * 60);
  if (error) {
    toast.error('Could not open document');
    return null;
  }
  return data?.signedUrl ?? null;
};
