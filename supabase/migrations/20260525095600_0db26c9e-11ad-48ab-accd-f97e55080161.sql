
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_name TEXT NOT NULL,
  referrer_phone TEXT NOT NULL,
  referrer_email TEXT,
  referee_name TEXT NOT NULL,
  referee_phone TEXT NOT NULL,
  referee_email TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  matched_client_id UUID,
  matched_application_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_referee_phone ON public.referrals(referee_phone);
CREATE INDEX idx_referrals_referee_email ON public.referrals(referee_email);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view referrals" ON public.referrals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update referrals" ON public.referrals
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete referrals" ON public.referrals
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
