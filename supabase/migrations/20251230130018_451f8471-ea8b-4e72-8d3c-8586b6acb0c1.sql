-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for checking roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles - users can see their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  price INTEGER NOT NULL,
  images TEXT[] DEFAULT '{}',
  transmission TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  color TEXT,
  engine_code TEXT,
  vin TEXT,
  finance_available BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'incoming', 'sold', 'reserved')),
  service_history TEXT,
  description TEXT,
  youtube_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Anyone can view available vehicles
CREATE POLICY "Anyone can view vehicles"
ON public.vehicles FOR SELECT
USING (true);

-- Only admins can insert vehicles
CREATE POLICY "Admins can insert vehicles"
ON public.vehicles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update vehicles
CREATE POLICY "Admins can update vehicles"
ON public.vehicles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete vehicles
CREATE POLICY "Admins can delete vehicles"
ON public.vehicles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create wishlists table to sync user wishlists
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, vehicle_id)
);

-- Enable RLS on wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Users can view their own wishlist
CREATE POLICY "Users can view their own wishlist"
ON public.wishlists FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can add to their own wishlist
CREATE POLICY "Users can add to their own wishlist"
ON public.wishlists FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own wishlist
CREATE POLICY "Users can remove from their own wishlist"
ON public.wishlists FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create finance_applications table
CREATE TABLE public.finance_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_number TEXT,
  monthly_income NUMERIC,
  employment_status TEXT,
  employer_name TEXT,
  deposit_amount NUMERIC,
  loan_term_months INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'declined')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on finance_applications
ALTER TABLE public.finance_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view their own applications"
ON public.finance_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can submit their own applications
CREATE POLICY "Users can submit their own applications"
ON public.finance_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.finance_applications FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.finance_applications FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

-- Create trigger for new user profiles
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_applications_updated_at
BEFORE UPDATE ON public.finance_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for vehicles
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;