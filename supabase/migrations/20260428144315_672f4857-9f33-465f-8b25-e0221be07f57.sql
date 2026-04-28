-- Restore execute permission on has_role for RLS policies to work
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;