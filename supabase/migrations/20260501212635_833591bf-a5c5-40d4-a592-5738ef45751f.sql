ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS platform_source text NOT NULL DEFAULT 'Direct/Unknown';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_platform_source
ON public.whatsapp_messages (platform_source);