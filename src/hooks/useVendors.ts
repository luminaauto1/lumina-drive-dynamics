// Vendors = the counterparties we BUY cars from (suppliers) and/or SELL finance
// deals to (finance houses, e.g. a dealer that buys the car from us for a client).
// Backed by public.vendors + public.vendor_documents + the private
// 'vendor-documents' storage bucket. Cast to `any` because these tables are not
// in the generated Supabase types yet.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VendorType = 'supplier' | 'finance_house' | 'both';

export interface Vendor {
  id: string;
  name: string;
  vendor_type: VendorType;
  registration_number: string | null;
  vat_number: string | null;
  is_vat_registered: boolean;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  invoice_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VendorInput = Omit<Vendor, 'id' | 'created_at' | 'updated_at'>;

export interface VendorDocument {
  id: string;
  vendor_id: string;
  label: string | null;
  doc_type: string | null;
  file_path: string;
  file_name: string | null;
  uploaded_at: string;
}

export const VENDOR_DOC_BUCKET = 'vendor-documents';

export const useVendors = (opts?: { activeOnly?: boolean }) => {
  return useQuery({
    queryKey: ['vendors', opts?.activeOnly ?? false],
    queryFn: async (): Promise<Vendor[]> => {
      let q = (supabase as any).from('vendors').select('*').order('name', { ascending: true });
      if (opts?.activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Vendor[];
    },
  });
};

export const useCreateVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<VendorInput>) => {
      const { data, error } = await (supabase as any)
        .from('vendors')
        .insert({ ...input, name: input.name?.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as Vendor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor added');
    },
    onError: (e: any) => toast.error('Failed to add vendor: ' + e.message),
  });
};

export const useUpdateVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<VendorInput> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('vendors')
        .update({ ...input, name: input.name?.trim() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Vendor;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor updated');
    },
    onError: (e: any) => toast.error('Failed to update vendor: ' + e.message),
  });
};

export const useDeleteVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('vendors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      qc.invalidateQueries({ queryKey: ['vendor-documents'] });
      toast.success('Vendor deleted');
    },
    onError: (e: any) =>
      toast.error('Failed to delete vendor: ' + (e.message?.includes('foreign key')
        ? 'it is still linked to a vehicle or deal.'
        : e.message)),
  });
};

export const useVendorDocuments = (vendorId: string | null) => {
  return useQuery({
    queryKey: ['vendor-documents', vendorId],
    enabled: !!vendorId,
    queryFn: async (): Promise<VendorDocument[]> => {
      const { data, error } = await (supabase as any)
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VendorDocument[];
    },
  });
};

export const useUploadVendorDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vendorId,
      file,
      label,
      docType,
    }: {
      vendorId: string;
      file: File;
      label?: string;
      docType?: string;
    }) => {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${vendorId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(VENDOR_DOC_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from('vendor_documents').insert({
        vendor_id: vendorId,
        file_path: path,
        file_name: file.name,
        label: label || file.name,
        doc_type: docType || 'other',
      });
      if (insErr) throw insErr;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['vendor-documents', v.vendorId] });
      toast.success('Document uploaded');
    },
    onError: (e: any) => toast.error('Upload failed: ' + e.message),
  });
};

export const useDeleteVendorDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: VendorDocument) => {
      await supabase.storage.from(VENDOR_DOC_BUCKET).remove([doc.file_path]);
      const { error } = await (supabase as any).from('vendor_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: (_d, doc) => {
      qc.invalidateQueries({ queryKey: ['vendor-documents', doc.vendor_id] });
      toast.success('Document removed');
    },
    onError: (e: any) => toast.error('Failed to remove document: ' + e.message),
  });
};

/** Open a private vendor document in a new tab via a short-lived signed URL. */
export const openVendorDocument = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from(VENDOR_DOC_BUCKET)
    .createSignedUrl(filePath, 60 * 10);
  if (error || !data?.signedUrl) {
    toast.error('Could not open document');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
};
