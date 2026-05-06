UPDATE public.finance_applications
SET is_archived = true
WHERE is_archived = false
  AND lower(trim(coalesce(status, ''))) IN ('declined', 'blacklisted', 'archive', 'archived');