-- Deploy before the new checkout page and webhook. Existing orders and RPCs keep working.
begin;

alter table public.card_orders alter column customer_name drop not null;
alter table public.card_orders alter column shipping_address drop not null;

create or replace function public.reserve_scoutcard_order_email_only(
  request_id uuid, customer_email text,
  terms_acknowledged boolean, adult_purchaser_acknowledged boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  previous public.card_orders%rowtype;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(customer_email));
begin
  if terms_acknowledged is distinct from true or adult_purchaser_acknowledged is distinct from true then
    raise exception 'Please acknowledge the terms and adult purchaser requirement.';
  end if;
  if request_id is null or coalesce(pg_catalog.char_length(normalized_email), 0) not between 3 and 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text, 0));
  select * into previous from public.card_orders where id = request_id;
  if found then
    if previous.email <> normalized_email then
      raise exception 'Order email changed. Start a new checkout.';
    end if;
    if previous.status <> 'payment_pending' then
      raise exception 'This order is already being processed. Contact support before ordering again.';
    end if;
    return request_id;
  end if;
  insert into public.card_orders(id, email, status, terms_version, terms_accepted_at, adult_purchaser_acknowledged_at)
  values(request_id, normalized_email, 'payment_pending', '2026-09-28', pg_catalog.now(), pg_catalog.now());
  return request_id;
end $$;
revoke all on function public.reserve_scoutcard_order_email_only(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.reserve_scoutcard_order_email_only(uuid,text,boolean,boolean) to anon,authenticated;

-- Distinct RPC name avoids changing the active webhook during the rollout.
create or replace function public.confirm_scoutcard_payment_with_shipping(
 p_event_id text, p_session_id text, p_order_id uuid, p_paid boolean,
 p_amount integer, p_currency text, p_payment_intent text,
 p_shipping_name text, p_shipping_address text, p_checkout_email text
) returns text language plpgsql security definer set search_path='' as $$
declare current_order public.card_orders%rowtype; result text; normalized_email text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$' or
    p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$' or
    p_order_id is null or p_paid is null or p_amount is null or p_amount<=0 or
    p_currency is null or p_currency !~ '^[a-z]{3}$' then
   raise exception 'Invalid payment notification';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id,0));
 if exists(select 1 from public.scoutcard_payment_events where event_id=p_event_id) then return 'duplicate'; end if;
 select * into current_order from public.card_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if current_order.stripe_session_id is not null and current_order.stripe_session_id<>p_session_id and p_paid then
   result:='review';
 elsif current_order.paid_at is not null or current_order.status in ('paid','shipped','fulfilled') then
   result:='already_paid';
 elsif p_paid and current_order.status in ('payment_pending','payment_failed') then
   if current_order.customer_name is null or current_order.shipping_address is null then
     if coalesce(pg_catalog.char_length(pg_catalog.btrim(p_shipping_name)),0) not between 2 and 100
        or coalesce(pg_catalog.char_length(pg_catalog.btrim(p_shipping_address)),0) not between 6 and 500 then
       raise exception 'Verified shipping information missing';
     end if;
   end if;
   normalized_email:=pg_catalog.lower(pg_catalog.btrim(p_checkout_email));
   if normalized_email is not null and
      (pg_catalog.char_length(normalized_email) not between 3 and 254 or
       normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
     raise exception 'Invalid checkout email';
   end if;
   update public.card_orders set status='paid', stripe_session_id=p_session_id,
     stripe_payment_intent=p_payment_intent, paid_at=pg_catalog.now(), amount_paid=p_amount, currency=p_currency,
     customer_name=coalesce(current_order.customer_name,pg_catalog.btrim(p_shipping_name)),
     shipping_address=coalesce(current_order.shipping_address,pg_catalog.btrim(p_shipping_address)),
     email=coalesce(normalized_email,current_order.email)
     where id=p_order_id;
   result:='paid';
 elsif not p_paid and current_order.status='payment_pending' then
   update public.card_orders set status='payment_failed' where id=p_order_id;
   result:='payment_failed';
 else result:='review';
 end if;
 insert into public.scoutcard_payment_events(event_id,session_id,order_id,paid,amount,currency,outcome)
 values(p_event_id,p_session_id,p_order_id,p_paid,p_amount,p_currency,result);
 return result;
end $$;
revoke all on function public.confirm_scoutcard_payment_with_shipping(text,text,uuid,boolean,integer,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.confirm_scoutcard_payment_with_shipping(text,text,uuid,boolean,integer,text,text,text,text,text)
  to service_role;

notify pgrst,'reload schema';
commit;
