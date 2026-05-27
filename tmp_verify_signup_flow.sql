select p.email, p.approved, p.organization_id, o.name as organization_name, s.id as subscription_id, ui.id as user_info_id, ui.user_id as user_info_user_id
from public.profiles p
left join public.organizations o on o.id = p.organization_id
left join public.subscriptions s on s.organization_id = p.organization_id
left join public.user_info ui on ui.user_id = p.id
where p.email = 'signup-flow-1775220831389@example.com';
