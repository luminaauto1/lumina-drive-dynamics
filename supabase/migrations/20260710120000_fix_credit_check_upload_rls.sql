-- Fix: F&I staff could READ credit-check screenshots but not UPLOAD them.
-- The credit-check-screenshots bucket's SELECT policy grants f_and_i /
-- senior_f_and_i / sales_agent (plus admin via the "Admins manage" ALL policy),
-- but the INSERT/UPDATE policies only allowed is_staff() = admin + sales_agent.
-- So the 8 f_and_i + 3 senior_f_and_i users (exactly who runs credit checks)
-- hit "new row violates row-level security policy" whenever they attached a
-- screenshot/PDF. This aligns upload/update with read: any staff role that can
-- SEE a credit-check document may also attach one.
-- Additive (broadens access to roles that already read these files); idempotent.

drop policy if exists "Staff upload credit-check-screenshots" on storage.objects;
create policy "Staff upload credit-check-screenshots"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'credit-check-screenshots'
  and (
    is_staff(auth.uid())
    or has_role(auth.uid(), 'f_and_i'::app_role)
    or has_role(auth.uid(), 'senior_f_and_i'::app_role)
  )
);

drop policy if exists "Staff update credit-check-screenshots" on storage.objects;
create policy "Staff update credit-check-screenshots"
on storage.objects for update to authenticated
using (
  bucket_id = 'credit-check-screenshots'
  and (
    is_staff(auth.uid())
    or has_role(auth.uid(), 'f_and_i'::app_role)
    or has_role(auth.uid(), 'senior_f_and_i'::app_role)
  )
)
with check (
  bucket_id = 'credit-check-screenshots'
  and (
    is_staff(auth.uid())
    or has_role(auth.uid(), 'f_and_i'::app_role)
    or has_role(auth.uid(), 'senior_f_and_i'::app_role)
  )
);
