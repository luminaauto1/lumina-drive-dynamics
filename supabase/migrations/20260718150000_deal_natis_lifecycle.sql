-- Deal Desk — NATIS lifecycle columns on deal_records (net-new, additive only)
-- plus additive dd_event_type enum values for the tab's activity logging.
-- Powers the rebuilt NATIS tab: a 6-step lifecycle stepper
--   Delivered → ID & POR → Original Natis → Dealer stock → Blue File → Ready to send
-- plus the location/plates toggles and the uploaded NATIS document pointer.
-- No triggers, no backfill, no RLS changes: writes ride the existing deal_records
-- UPDATE policy (admin + senior F&I), exactly like natis_sent_at before it.

-- The NATIS tab logs lifecycle activity to deal_events under dedicated event
-- kinds, and deal_events.event_type is the dd_event_type ENUM (20260622130000)
-- — so the enum must grow with it or every insert is rejected (silently, in the
-- fire-and-forget logDealEvent path; loudly for the tab's manual notes).
-- 'stage_changed' is included too: useSetDealStage has logged it since the
-- deal-stage work but it was never added to the enum, so those timeline rows
-- were being dropped. ADD VALUE IF NOT EXISTS = idempotent, purely additive.
ALTER TYPE public.dd_event_type ADD VALUE IF NOT EXISTS 'stage_changed';
ALTER TYPE public.dd_event_type ADD VALUE IF NOT EXISTS 'natis_stage_changed';
ALTER TYPE public.dd_event_type ADD VALUE IF NOT EXISTS 'natis_updated';
ALTER TYPE public.dd_event_type ADD VALUE IF NOT EXISTS 'natis_note';
ALTER TYPE public.dd_event_type ADD VALUE IF NOT EXISTS 'natis_doc_uploaded';

ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_stage            text;
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_location         text;
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_plates_disc_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_whatsapp_on_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.deal_records ADD COLUMN IF NOT EXISTS natis_doc_path         text;

COMMENT ON COLUMN public.deal_records.natis_stage IS
  'NATIS lifecycle step: delivered | id_por | original_natis | dealer_stock | blue_file | ready_to_send. NULL = not started (the UI defaults to ''delivered'' once the deal is delivered) or lifecycle complete (cleared when natis_sent_at is set). Free text on purpose — validated app-side, mirroring deal_stage.';

COMMENT ON COLUMN public.deal_records.natis_location IS
  'Where the registration happens: gauteng (dealer does plates + disc) | outside_gp (send the NATIS only). NULL = not chosen yet.';

COMMENT ON COLUMN public.deal_records.natis_plates_disc_done IS
  'Gauteng deals: number plates + licence disc completed. Checking it can open a prefilled WhatsApp to the client when natis_whatsapp_on_done is on (click-to-chat only — nothing auto-sends).';

COMMENT ON COLUMN public.deal_records.natis_whatsapp_on_done IS
  'Opt-in: when plates & disc are marked done, open a wa.me click-to-chat prefilled for the client. Pure UI preference — no dispatch infrastructure reads this.';

COMMENT ON COLUMN public.deal_records.natis_doc_path IS
  'Storage path of the uploaded NATIS document in the ''documents'' bucket (deal/{deal_id}/natis/...). Viewed via short-lived signed URLs.';
