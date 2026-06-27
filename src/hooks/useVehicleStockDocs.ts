import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressIfImage } from '@/lib/compressFile';
import {
  StockDocKey,
  StockDocStatus,
  STOCK_DOC_DEFS,
  STOCK_DOC_KEYS,
  isOutstanding,
} from '@/lib/stockDocs';

// Files for the stock-in checklist live in the existing documents bucket, mirroring
// the DocumentManager upload pattern (compress images, then upload, store file_path).
const DOCUMENTS_BUCKET = 'documents';

export interface VehicleStockDoc {
  id: string;
  vehicle_id: string;
  doc_key: StockDocKey;
  status: StockDocStatus;
  file_path: string | null;
  note: string | null;
  updated_at: string;
}

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 120);

const docsKey = (vehicleId?: string) => ['vehicle-stock-docs', vehicleId ?? null];

/**
 * List the stock-in doc slots for a vehicle. The 4 required slots are guaranteed:
 * any key missing a row is filled in with a synthetic 'missing' placeholder so the
 * checklist always renders all 4 (rows are created lazily on first status change).
 */
export const useVehicleStockDocs = (vehicleId?: string) => {
  return useQuery({
    queryKey: docsKey(vehicleId),
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vehicle_stock_docs')
        .select('*')
        .eq('vehicle_id', vehicleId);
      if (error) throw error;

      const rows = (data || []) as VehicleStockDoc[];
      const byKey = new Map(rows.map((r) => [r.doc_key, r]));

      // Always return all 4 slots in defined order; synthesize placeholders for gaps.
      return STOCK_DOC_DEFS.map((def): VehicleStockDoc => {
        const existing = byKey.get(def.key);
        if (existing) return existing;
        return {
          id: `placeholder-${def.key}`,
          vehicle_id: vehicleId!,
          doc_key: def.key,
          status: 'missing',
          file_path: null,
          note: null,
          updated_at: new Date(0).toISOString(),
        };
      });
    },
  });
};

interface UpsertArgs {
  vehicleId: string;
  docKey: StockDocKey;
  status?: StockDocStatus;
  filePath?: string | null;
  note?: string | null;
}

/** Upsert a single doc slot's status / file_path / note (keyed by vehicle_id + doc_key). */
export const useUpsertVehicleStockDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpsertArgs) => {
      const payload: Record<string, unknown> = {
        vehicle_id: args.vehicleId,
        doc_key: args.docKey,
      };
      if (args.status !== undefined) payload.status = args.status;
      if (args.filePath !== undefined) payload.file_path = args.filePath;
      if (args.note !== undefined) payload.note = args.note;

      const { data, error } = await (supabase as any)
        .from('vehicle_stock_docs')
        .upsert(payload, { onConflict: 'vehicle_id,doc_key' })
        .select()
        .single();
      if (error) throw error;
      return data as VehicleStockDoc;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: docsKey(vars.vehicleId) });
    },
    onError: (error: any) => {
      console.error('Stock doc update failed:', error);
      toast.error('Could not update document status');
    },
  });
};

interface UploadArgs {
  vehicleId: string;
  docKey: StockDocKey;
  file: File;
}

/** Compress (images) → upload to the documents bucket → mark the slot 'uploaded' + store file_path. */
export const useUploadVehicleStockDoc = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: UploadArgs) => {
      const compressed = await compressIfImage(args.file, 'balanced');
      const path = `vehicle/${args.vehicleId}/stock-docs/${args.docKey}/${Date.now()}-${sanitizeName(compressed.name)}`;

      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, compressed, { contentType: compressed.type || undefined, upsert: false });
      if (upErr) throw upErr;

      const { data, error } = await (supabase as any)
        .from('vehicle_stock_docs')
        .upsert(
          { vehicle_id: args.vehicleId, doc_key: args.docKey, status: 'uploaded', file_path: path },
          { onConflict: 'vehicle_id,doc_key' },
        )
        .select()
        .single();

      if (error) {
        // Roll back the orphaned storage object if the row write failed.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        throw error;
      }
      return data as VehicleStockDoc;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: docsKey(vars.vehicleId) });
      toast.success('Document uploaded');
    },
    onError: (error: any) => {
      console.error('Stock doc upload failed:', error);
      toast.error('Upload failed: ' + (error?.message || 'unknown error'));
    },
  });
};

/** Create a signed URL to view/download an uploaded stock doc. */
export const getStockDocUrl = async (filePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 60 * 60);
  if (error) {
    toast.error('Could not open document');
    return null;
  }
  return data?.signedUrl ?? null;
};

/** Count of outstanding (still-missing) doc slots given a docs list. */
export const countOutstanding = (docs: VehicleStockDoc[] | undefined): number =>
  (docs || []).filter((d) => isOutstanding(d.status)).length;

export const STOCK_DOC_TOTAL = STOCK_DOC_KEYS.length;
