-- Payment verification notification flow

alter table public.payment_requests
  add column if not exists verification_requested_at timestamptz;

create or replace function private.notify_firstreply_payment_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
begin
  if old.verification_requested_at is not null
    or new.verification_requested_at is null then
    return new;
  end if;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'firstreply_signup_webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise warning 'FirstReply payment webhook secret is missing';
    return new;
  end if;

  perform net.http_post(
    url := 'https://firstreply-gamma.vercel.app/api/webhooks/payment-request',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', to_jsonb(old)
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function private.notify_firstreply_payment_review()
  from public, anon, authenticated;

create trigger firstreply_payment_review_webhook
after update of verification_requested_at on public.payment_requests
for each row
when (
  old.verification_requested_at is null
  and new.verification_requested_at is not null
)
execute function private.notify_firstreply_payment_review();
