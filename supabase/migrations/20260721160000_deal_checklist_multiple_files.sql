-- Multiple documents per checklist item. deal_checklist_docs keeps ONE status
-- row per (deal, section, item); the files move to a child table so an item can
-- hold a whole set (e.g. every NATIS in the chain, a full service history).
CREATE TABLE IF NOT EXISTS public.deal_checklist_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deal_records(id) ON DELETE CASCADE,
  section     text NOT NULL,
  item_key    text NOT NULL,
  file_path   text NOT NULL,
  file_name   text,
  uploaded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_checklist_files_item_idx
  ON public.deal_checklist_files (deal_id, section, item_key);
-- The same storage object must never be attached twice.
CREATE UNIQUE INDEX IF NOT EXISTS deal_checklist_files_path_key
  ON public.deal_checklist_files (file_path);

ALTER TABLE public.deal_checklist_files ENABLE ROW LEVEL SECURITY;

-- Same audience as deal_checklist_docs (delivery roles incl. sales agents).
CREATE POLICY "deal_checklist_files select" ON public.deal_checklist_files
  FOR SELECT TO authenticated USING ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_files insert" ON public.deal_checklist_files
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_files update" ON public.deal_checklist_files
  FOR UPDATE TO authenticated USING ((SELECT public.can_deal_delivery()))
  WITH CHECK ((SELECT public.can_deal_delivery()));
CREATE POLICY "deal_checklist_files delete" ON public.deal_checklist_files
  FOR DELETE TO authenticated USING ((SELECT public.can_deal_delivery()));

-- Carry every existing single upload across so nothing disappears from the UI.
INSERT INTO public.deal_checklist_files (deal_id, section, item_key, file_path, file_name, uploaded_by, created_at)
SELECT d.deal_id, d.section, d.item_key, d.file_path, d.file_name, d.updated_by, coalesce(d.updated_at, now())
FROM public.deal_checklist_docs d
WHERE d.file_path IS NOT NULL
ON CONFLICT (file_path) DO NOTHING;
