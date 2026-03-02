
CREATE TABLE IF NOT EXISTS public.trade_network (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  typical_admin_fee NUMERIC DEFAULT 0,
  negotiability TEXT DEFAULT 'medium',
  contact_persons JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.trade_network ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trade network"
  ON public.trade_network FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
