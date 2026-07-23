-- Public inventory-card finance structure.
--
-- The "Est. R x/pm*" figure on every public VehicleCard used to run through a
-- hidden "marketing" layer: rate auto-discounted 1%, term auto-stretched to 96
-- months over R250k, and the balloon % applied as if it were a deposit (removed
-- from the financed amount, so no interest accrued on it). Owner found the
-- numbers too low and asked to control the four levers directly.
--
-- These four columns are the WYSIWYG structure the card now uses verbatim.
-- Deliberately SEPARATE from the existing default_/min_/max_ fields, which drive
-- the public finance CALCULATOR and the quote tools — editing the card display
-- must not move those, and vice-versa.
--
-- card_deposit_percent  → % of price paid upfront, reduces what's financed.
-- card_balloon_percent  → % deferred to a lump sum at term end. Full price is
--                         still financed and accrues interest (proper balloon),
--                         so this RAISES the monthly vs the old deposit-style math.
-- card_term_months      → amortisation term for the estimate.
-- card_interest_rate    → rate used verbatim (no teaser discount). NULL = fall
--                         back to default_interest_rate so existing installs keep
--                         a sensible number until the owner sets one.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS card_interest_rate  numeric,
  ADD COLUMN IF NOT EXISTS card_deposit_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_balloon_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_term_months     integer NOT NULL DEFAULT 72;

COMMENT ON COLUMN public.site_settings.card_interest_rate IS
  'Interest rate (%) used verbatim for the public VehicleCard /pm estimate. NULL => fall back to default_interest_rate. No teaser discount.';
COMMENT ON COLUMN public.site_settings.card_deposit_percent IS
  'Deposit (% of price) assumed for the public VehicleCard /pm estimate. Reduces the financed amount.';
COMMENT ON COLUMN public.site_settings.card_balloon_percent IS
  'Balloon (% of price) for the public VehicleCard /pm estimate. Proper residual: full price is financed and accrues interest, the balloon is a lump sum at term end.';
COMMENT ON COLUMN public.site_settings.card_term_months IS
  'Term (months) used for the public VehicleCard /pm estimate.';
