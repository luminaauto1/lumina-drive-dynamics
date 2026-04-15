CREATE TABLE IF NOT EXISTS client_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT,
  client_phone TEXT,
  author_name TEXT DEFAULT 'Admin Staff',
  action_type TEXT DEFAULT 'note',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit logs"
ON client_audit_logs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));