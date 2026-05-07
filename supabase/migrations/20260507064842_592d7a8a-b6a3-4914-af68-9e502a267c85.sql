-- Add timestamp tracking for when an F&I rep claims an application
ALTER TABLE public.finance_applications
ADD COLUMN assigned_f_and_i_at TIMESTAMP WITH TIME ZONE NULL;

-- Add index for efficient querying by claim time
CREATE INDEX idx_finance_applications_assigned_f_and_i_at
ON public.finance_applications(assigned_f_and_i_at);