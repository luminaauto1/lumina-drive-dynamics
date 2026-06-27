-- Contract-signed → Deal Desk draft (DB-side resilience, OPTIONAL / NOT relied upon).
--
-- This AFTER UPDATE trigger mirrors the application-layer logic in
-- useUpdateFinanceApplication: when a finance_applications row transitions to
-- status 'contract_signed', and the feature flag is ON, and no deal_records row
-- yet exists for that application, it inserts a DRAFT deal_records row.
--
-- Design rules (match the hook exactly):
--   • FEATURE-FLAGGED OFF BY DEFAULT — gated on
--     site_settings.document_settings->>'autoCreateDealOnContractSigned' = 'true'.
--     With the flag absent/false this trigger does nothing.
--   • IDEMPOTENT — guarded by NOT EXISTS on deal_records(application_id); never
--     creates a duplicate. A partial unique index further enforces this at the
--     DB level for the auto-draft path.
--   • The draft has NO sale_date and all financial fields 0, so it is excluded
--     from Accounting/Reports and reads as 'contract_signed' in Deal Desk until
--     a human finalizes it.
--   • Fully defensive: any error inside the trigger is swallowed so it can never
--     abort the underlying status update.
--
-- NOTE: This file is provided for resilience but is NOT applied by this change
-- set. The app-layer hook is the primary path. Apply this only if you also want
-- non-hook write paths (SQL console, other services) to create drafts.

create or replace function public.fn_contract_signed_deal_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled  boolean := false;
  v_price    numeric := 0;
begin
  -- Only act on an actual transition INTO 'contract_signed'.
  if new.status is distinct from 'contract_signed'
     or old.status is not distinct from new.status then
    return new;
  end if;

  -- Read the feature flag from the shared document_settings JSON blob.
  begin
    select coalesce((s.document_settings->>'autoCreateDealOnContractSigned')::boolean, false)
      into v_enabled
      from public.site_settings s
      limit 1;
  exception when others then
    v_enabled := false;
  end;

  if coalesce(v_enabled, false) is not true then
    return new;
  end if;

  -- Need a vehicle to anchor the draft.
  if new.vehicle_id is null then
    return new;
  end if;

  -- Idempotency guard: skip if a deal_records row already exists.
  if exists (select 1 from public.deal_records dr where dr.application_id = new.id) then
    return new;
  end if;

  -- Default sold_price from the matched vehicle's listed price.
  begin
    select coalesce(v.price, 0) into v_price
      from public.vehicles v
      where v.id = new.vehicle_id
      limit 1;
  exception when others then
    v_price := 0;
  end;

  -- Insert the draft (all figures zero, no sale_date / delivery / rep).
  begin
    insert into public.deal_records (
      application_id, vehicle_id, sold_price,
      cost_price, gross_profit, recon_cost, discount_amount,
      dealer_deposit_contribution, external_admin_fee, bank_initiation_fee,
      total_financed_amount, client_deposit, dic_amount, sales_rep_commission,
      referral_commission_amount, referral_income_amount, partner_capital_contribution,
      is_shared_capital, is_closed, addons_data, aftersales_expenses
    ) values (
      new.id, new.vehicle_id, coalesce(v_price, 0),
      0, 0, 0, 0,
      0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0,
      false, false, '[]'::jsonb, '[]'::jsonb
    );
  exception when others then
    -- Never abort the status update because of the draft insert.
    raise warning 'fn_contract_signed_deal_draft: draft insert failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- Belt-and-braces idempotency: at most one deal_records row per application.
-- Partial-safe: only enforced where application_id is set.
create unique index if not exists deal_records_application_id_unique
  on public.deal_records (application_id)
  where application_id is not null;

drop trigger if exists trg_contract_signed_deal_draft on public.finance_applications;
create trigger trg_contract_signed_deal_draft
  after update of status on public.finance_applications
  for each row
  execute function public.fn_contract_signed_deal_draft();
