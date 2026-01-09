-- 1. Create client comments table
CREATE TABLE IF NOT EXISTS public.client_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create client documents table
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.client_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for client comments
CREATE POLICY "Admins can view client comments"
ON public.client_comments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client comments"
ON public.client_comments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client comments"
ON public.client_comments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create RLS policies for client documents
CREATE POLICY "Admins can view client documents"
ON public.client_documents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client documents"
ON public.client_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client documents"
ON public.client_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Add stock_number column to vehicles table
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS stock_number TEXT;