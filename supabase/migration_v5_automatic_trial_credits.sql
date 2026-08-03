-- FirstReply V5: grant the free trial to new accounts automatically.
--
-- This migration only changes the signup trigger. It does not update existing
-- profiles or existing credit balances.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    )
  )
  on conflict (id) do nothing;

  insert into public.credit_balances (user_id, credits)
  values (new.id, 10)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

comment on function public.handle_new_user() is
  'Creates a FirstReply profile and grants 10 trial credits to a new auth user.';