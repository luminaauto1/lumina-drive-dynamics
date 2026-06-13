-- The recon/inventory task tracker (VehicleOperationsTab, mounted in
-- AdminInventoryPage) reads & writes public.inventory_tasks via useInventoryTasks,
-- but the table only ever existed on the old Lovable DB (created via dashboard,
-- not a migration) so it was never replayed into production. The read path throws
-- on the missing table, breaking the vehicle Operations tab. Recreate it to match
-- the hook's InventoryTask shape, with admin-only RLS like vehicle_expenses.
CREATE TABLE IF NOT EXISTS public.inventory_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  task_name    text NOT NULL,
  category     text NOT NULL DEFAULT 'admin'
                 CHECK (category IN ('mechanical', 'aesthetic', 'valet', 'admin')),
  cost         numeric NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_tasks_vehicle_id_idx ON public.inventory_tasks (vehicle_id);
CREATE INDEX IF NOT EXISTS inventory_tasks_status_idx     ON public.inventory_tasks (status);

ALTER TABLE public.inventory_tasks ENABLE ROW LEVEL SECURITY;

-- Mirror vehicle_expenses: admins manage everything.
CREATE POLICY "Admins can view inventory tasks"
  ON public.inventory_tasks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert inventory tasks"
  ON public.inventory_tasks FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inventory tasks"
  ON public.inventory_tasks FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete inventory tasks"
  ON public.inventory_tasks FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_tasks TO authenticated;

NOTIFY pgrst, 'reload schema';
