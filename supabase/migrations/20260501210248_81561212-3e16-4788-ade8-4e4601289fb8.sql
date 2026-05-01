CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_created_at
  ON public.whatsapp_messages (created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp messages"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales agents can view whatsapp messages"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'sales_agent'::app_role));
