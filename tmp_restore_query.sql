select proname, pg_get_functiondef(oid) as definition
from pg_proc
where proname in ('handle_restore_diogo');
