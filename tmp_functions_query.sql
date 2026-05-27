select proname, pg_get_functiondef(oid) as definition
from pg_proc
where proname in (
  'handle_new_user',
  'process_invite_code_on_signup',
  'handle_profile_changes',
  'link_invited_user_to_organization',
  'bootstrap_organization_for_profile',
  'create_subscription_for_organization',
  'sync_profile_organization'
)
order by proname;
