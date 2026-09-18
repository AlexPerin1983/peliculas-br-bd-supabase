-- Supabase can grant EXECUTE directly to anon through default privileges.
-- Revoking PUBLIC alone does not remove that independent grant.
REVOKE ALL ON FUNCTION public.apply_proposal_follow_up(integer, numeric, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_proposal_follow_up(integer, numeric, text, jsonb, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
