-- 1. Create Table for "Sell Your Car" Submissions
CREATE TABLE public.sell_car_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_contact TEXT NOT NULL,
  client_email TEXT,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year NUMERIC,
  vehicle_mileage NUMERIC,
  desired_price NUMERIC,
  condition TEXT,
  photos_urls TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Enable RLS
ALTER TABLE public.sell_car_requests ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Anyone can submit a sell request
CREATE POLICY "Anyone can submit sell requests" ON public.sell_car_requests 
FOR INSERT WITH CHECK (true);

-- Admins can view all sell requests
CREATE POLICY "Admins can view sell requests" ON public.sell_car_requests 
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update sell requests
CREATE POLICY "Admins can update sell requests" ON public.sell_car_requests 
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete sell requests
CREATE POLICY "Admins can delete sell requests" ON public.sell_car_requests 
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));