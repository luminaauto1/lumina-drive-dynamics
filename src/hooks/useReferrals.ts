import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeEmail, normalizePhone } from '@/lib/normalizeContact';

export type ReferralStatus = 'Pending' | 'In Progress' | 'Fee Outstanding' | 'Paid' | 'Declined';

export interface Referral {
  id: string;
  referrer_name: string;
  referrer_phone: string;
  referrer_email: string | null;
  referee_name: string;
  referee_phone: string;
  referee_email: string | null;
  status: ReferralStatus;
  matched_client_id: string | null;
  matched_application_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useReferrals = () => {
  return useQuery({
    queryKey: ['referrals'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Referral[];
    },
  });
};

export const useOutstandingReferralCount = () => {
  return useQuery({
    queryKey: ['referrals', 'outstanding-count'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Fee Outstanding');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60_000,
  });
};

export interface ReferralInsert {
  referrer_name: string;
  referrer_phone: string;
  referrer_email?: string | null;
  referee_name: string;
  referee_phone: string;
  referee_email?: string | null;
  notes?: string | null;
}

export const useCreateReferral = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReferralInsert) => {
      const payload = {
        referrer_name: input.referrer_name.trim(),
        referrer_phone: input.referrer_phone.trim(),
        referrer_email: input.referrer_email?.trim().toLowerCase() || null,
        referee_name: input.referee_name.trim(),
        referee_phone: input.referee_phone.trim(),
        referee_email: input.referee_email?.trim().toLowerCase() || null,
        notes: input.notes?.trim() || null,
        status: 'Pending',
      };
      const { data, error } = await (supabase as any)
        .from('referrals')
        .insert(payload)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as Referral;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      toast.success('Referral logged');
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || 'Failed to log referral');
    },
  });
};

export const useMarkReferralPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('referrals')
        .update({ status: 'Paid' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] });
      toast.success('Marked as paid');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update'),
  });
};

/**
 * Silent cross-reference: when a deal is finalized, check Pending referrals
 * to see if the referee matches the buyer's contact details.
 * Returns array of matched referral rows after flipping them to Fee Outstanding.
 */
export const crossReferenceReferral = async (params: {
  applicationId: string;
  clientId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<Referral[]> => {
  const email = normalizeEmail(params.email);
  const phone = normalizePhone(params.phone);
  if (!email && !phone) return [];

  try {
    const { data, error } = await (supabase as any)
      .from('referrals')
      .select('*')
      .eq('status', 'Pending');
    if (error || !data) return [];

    const matches: Referral[] = (data as Referral[]).filter((r) => {
      const rEmail = normalizeEmail(r.referee_email);
      const rPhone = normalizePhone(r.referee_phone);
      const emailMatch = !!email && !!rEmail && rEmail === email;
      const phoneMatch = !!phone && !!rPhone && rPhone === phone;
      return emailMatch || phoneMatch;
    });

    if (matches.length === 0) return [];

    await Promise.all(
      matches.map((m) =>
        (supabase as any)
          .from('referrals')
          .update({
            status: 'Fee Outstanding',
            matched_client_id: params.clientId || null,
            matched_application_id: params.applicationId,
          })
          .eq('id', m.id),
      ),
    );

    matches.forEach((m) => {
      toast.success(
        `Referral conversion: ${m.referrer_name} is owed a fee for ${m.referee_name}'s finalized deal.`,
        { duration: 8000 },
      );
    });

    return matches;
  } catch (e) {
    console.error('Referral cross-reference failed (non-fatal):', e);
    return [];
  }
};
