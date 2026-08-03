-- FirstReply V6: automated and idempotent PayPal Checkout fulfillment.
--
-- Existing manual payment requests remain valid. This migration adds PayPal
-- identifiers and a single transaction that marks a request paid and grants
-- its credits exactly once.

alter table public.payment_requests
  add column if not exists payment_provider text not null default 'paypal_manual',
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_environment text;

create unique index if not exists payment_requests_paypal_order_id_key
  on public.payment_requests (paypal_order_id)
  where paypal_order_id is not null;

create unique index if not exists payment_requests_paypal_capture_id_key
  on public.payment_requests (paypal_capture_id)
  where paypal_capture_id is not null;

create or replace function public.complete_paypal_payment(
  p_payment_request_id uuid,
  p_paypal_order_id text,
  p_paypal_capture_id text,
  p_amount_cents integer,
  p_currency text
)
returns table (
  credits_granted integer,
  total_credits integer,
  already_processed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.payment_requests%rowtype;
  resulting_balance integer;
begin
  select *
  into request_row
  from public.payment_requests
  where id = p_payment_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;

  if request_row.status = 'paid' then
    if request_row.paypal_order_id is distinct from p_paypal_order_id
      or request_row.paypal_capture_id is distinct from p_paypal_capture_id then
      raise exception 'Payment request was completed by another PayPal capture';
    end if;

    select credits
    into resulting_balance
    from public.credit_balances
    where user_id = request_row.user_id;

    return query
      select 0, coalesce(resulting_balance, 0), true;
    return;
  end if;

  if request_row.status <> 'pending'
    or request_row.payment_provider <> 'paypal_checkout'
    or request_row.paypal_order_id is distinct from p_paypal_order_id
    or request_row.amount_cents <> p_amount_cents
    or request_row.currency <> p_currency then
    raise exception 'PayPal payment does not match the pending request';
  end if;

  if exists (
    select 1
    from public.payment_requests
    where paypal_capture_id = p_paypal_capture_id
      and id <> p_payment_request_id
  ) then
    raise exception 'PayPal capture was already used';
  end if;

  insert into public.credit_balances (user_id, credits, updated_at)
  values (request_row.user_id, 0, now())
  on conflict (user_id) do nothing;

  update public.credit_balances
  set
    credits = credits + request_row.credits_requested,
    updated_at = now()
  where user_id = request_row.user_id
  returning credits into resulting_balance;

  update public.payment_requests
  set
    status = 'paid',
    paid_at = now(),
    validated_by = 'paypal_api',
    paypal_capture_id = p_paypal_capture_id,
    paypal_reference = p_paypal_capture_id,
    admin_note = 'PayPal Checkout payment captured and verified automatically.'
  where id = p_payment_request_id;

  return query
    select request_row.credits_requested, resulting_balance, false;
end;
$$;

revoke all on function public.complete_paypal_payment(
  uuid,
  text,
  text,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.complete_paypal_payment(
  uuid,
  text,
  text,
  integer,
  text
) to service_role;
