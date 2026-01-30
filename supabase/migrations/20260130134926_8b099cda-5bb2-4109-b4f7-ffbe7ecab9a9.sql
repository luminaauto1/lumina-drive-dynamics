-- 1. Create finance_banks table to store bank links
CREATE TABLE IF NOT EXISTS finance_banks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  signing_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add contract info columns to finance_applications
ALTER TABLE finance_applications 
ADD COLUMN IF NOT EXISTS contract_bank_name TEXT,
ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- 3. Enable RLS for finance_banks
ALTER TABLE finance_banks ENABLE ROW LEVEL SECURITY;

-- 4. Admins can manage banks (CRUD)
CREATE POLICY "Admins can manage banks" ON finance_banks 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Everyone can read banks
CREATE POLICY "Everyone can read banks" ON finance_banks 
FOR SELECT 
USING (true);