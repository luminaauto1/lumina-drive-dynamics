-- 1. RENTALS TABLE (The Fleet)
CREATE TABLE public.rentals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Car Details
  vehicle_make_model TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  vin_number TEXT,
  purchase_price NUMERIC DEFAULT 0,
  initial_recon_cost NUMERIC DEFAULT 0,
  -- Renter Details
  renter_name TEXT,
  renter_contact TEXT,
  renter_id_number TEXT,
  -- Financials
  monthly_rent NUMERIC NOT NULL,
  deposit_amount NUMERIC DEFAULT 0,
  payment_day INTEGER DEFAULT 1,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. RENTAL LOGS (Income & Expenses)
CREATE TABLE public.rental_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  log_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. EXTRA SERVICES (Arbitrage/Parts)
CREATE TABLE public.extra_service_incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  provider_name TEXT,
  cost_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'completed',
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_service_incomes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies using has_role function
CREATE POLICY "Admins can manage rentals" ON public.rentals FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage rental logs" ON public.rental_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage extra services" ON public.extra_service_incomes FOR ALL USING (public.has_role(auth.uid(), 'admin'));