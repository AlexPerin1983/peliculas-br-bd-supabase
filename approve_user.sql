create or replace function approve_user_by_email(user_email text)
returns void
language plpgsql
security definer -- Isso faz a função rodar com permissão de superusuário
as $$
begin
  update profiles
  set approved = true
  where email = user_email;
end;
$$;
