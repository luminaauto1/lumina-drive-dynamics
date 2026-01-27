-- Create Pre-Sale Expenses Table (Fuel, Tolls, Slips)
CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'general',
  receipt_url TEXT,
  date_incurred DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- Admin Policies using has_role function
CREATE POLICY "Admins can view all expenses" 
  ON public.vehicle_expenses FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert expenses" 
  ON public.vehicle_expenses FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update expenses" 
  ON public.vehicle_expenses FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete expenses" 
  ON public.vehicle_expenses FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'::app_role));