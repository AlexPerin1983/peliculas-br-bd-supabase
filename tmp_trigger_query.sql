select n.nspname as schema_name,
       c.relname as table_name,
       t.tgname as trigger_name,
       p.proname as function_name,
       pg_get_triggerdef(t.oid, true) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and ((n.nspname = 'auth' and c.relname = 'users')
    or (n.nspname = 'public' and c.relname in ('profiles', 'organizations', 'organization_members')))
order by n.nspname, c.relname, t.tgname;
