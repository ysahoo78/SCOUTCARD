-- Record the acknowledgments shown before a SCOUTCARD order is reserved.
-- Keep the original RPC available until the updated site is deployed, then revoke it.
alter table public.card_orders
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists adult_purchaser_acknowledged_at timestamptz;

create or replace function public.reserve_scoutcard_order_with_consent(
  request_id uuid,
  customer_name text,
  customer_email text,
  delivery_address text,
  terms_acknowledged boolean,
  adult_purchaser_acknowledged boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.card_orders%rowtype;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(customer_email));
begin
  if terms_acknowledged is distinct from true
     or adult_purchaser_acknowledged is distinct from true then
    raise exception 'Please review and acknowledge the terms and adult purchaser requirement.';
  end if;

  if request_id is null
     or coalesce(pg_catalog.char_length(pg_catalog.btrim(customer_name)), 0) not between 2 and 100
     or coalesce(pg_catalog.char_length(normalized_email), 0) not between 3 and 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or coalesce(pg_catalog.char_length(pg_catalog.btrim(delivery_address)), 0) not between 6 and 500 then
    raise exception 'Enter your name, a valid email, and your full shipping address.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text, 0));
  select * into previous from public.card_orders where id = request_id;
  if found then
    if previous.customer_name <> pg_catalog.btrim(customer_name)
       or previous.email <> normalized_email
       or previous.shipping_address <> pg_catalog.btrim(delivery_address) then
      raise exception 'Order details changed. Please start a new checkout.';
    end if;
    if previous.status <> 'payment_pending' then
      raise exception 'This order is already being processed. Please contact support before ordering again.';
    end if;
    if previous.terms_accepted_at is null then
      update public.card_orders
         set terms_version = '2026-09-28',
             terms_accepted_at = pg_catalog.now(),
             adult_purchaser_acknowledged_at = pg_catalog.now()
       where id = request_id;
    end if;
    return request_id;
  end if;

  insert into public.card_orders(
    id, customer_name, email, shipping_address, status,
    terms_version, terms_accepted_at, adult_purchaser_acknowledged_at
  ) values (
    request_id, pg_catalog.btrim(customer_name), normalized_email,
    pg_catalog.btrim(delivery_address), 'payment_pending',
    '2026-09-28', pg_catalog.now(), pg_catalog.now()
  );
  return request_id;
end;
$$;

revoke all on function public.reserve_scoutcard_order_with_consent(uuid,text,text,text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_scoutcard_order_with_consent(uuid,text,text,text,boolean,boolean)
  to anon, authenticated;
notify pgrst, 'reload schema';
