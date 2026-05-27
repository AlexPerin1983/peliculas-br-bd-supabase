-- O trigger legado on_profile_changes vinha derrubando o signup do auth.users
-- com erro 500. A criacao da empresa passa a acontecer no onboarding
-- (bootstrap-organization) apos o primeiro login.
DROP TRIGGER IF EXISTS on_profile_changes ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created_bootstrap_organization ON public.profiles;
