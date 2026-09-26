-- Apply after athletelink-setup.sql. No profiles, orders, or cards are deleted.
begin;
alter table public.card_orders add column if not exists stripe_session_id text;
alter table public.card_orders add column if not exists stripe_payment_intent text;
alter table public.card_orders add column if not exists paid_at timestamptz;
alter table public.card_orders add column if not exists amount_paid integer;
alter table public.card_orders add column if not exists currency text;
create unique index if not exists card_orders_stripe_session_idx on public.card_orders(stripe_session_id);
create table if not exists public.scoutcard_payment_events (
 event_id text primary key, session_id text not null, order_id uuid not null,
 paid boolean not null, amount integer not null, currency text not null,
 outcome text not null, received_at timestamptz not null default now()
);
alter table public.scoutcard_payment_events enable row level security;
revoke all on public.scoutcard_payment_events from public, anon, authenticated;

create or replace function public.confirm_scoutcard_payment(
 p_event_id text, p_session_id text, p_order_id uuid, p_paid boolean,
 p_amount integer, p_currency text, p_payment_intent text
) returns text language plpgsql security definer set search_path='' as $$
declare current_order public.card_orders%rowtype; result text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$' or
    p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$' or
    p_paid is null or p_amount is null or p_amount<=0 or p_currency is null or p_currency !~ '^[a-z]{3}$' then
   raise exception 'Invalid payment notification';
 end if;
 -- Serialize by session, then order; retries cannot apply a payment twice.
 perform pg_advisory_xact_lock(hashtextextended(p_session_id,0));
 if exists(select 1 from public.scoutcard_payment_events where event_id=p_event_id) then return 'duplicate'; end if;
 select * into current_order from public.card_orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if current_order.stripe_session_id is not null and current_order.stripe_session_id<>p_session_id and p_paid then
   result:='review'; -- A second paid checkout for one order needs manual review, not another shipment.
 elsif current_order.paid_at is not null or current_order.status in ('paid','shipped','fulfilled') then
   result:='already_paid'; -- Late failures never downgrade a successful payment.
 elsif p_paid and current_order.status in ('payment_pending','payment_failed') then
   update public.card_orders set status='paid', stripe_session_id=p_session_id,
     stripe_payment_intent=p_payment_intent, paid_at=now(), amount_paid=p_amount, currency=p_currency
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
revoke all on function public.confirm_scoutcard_payment(text,text,uuid,boolean,integer,text,text) from public,anon,authenticated;
grant execute on function public.confirm_scoutcard_payment(text,text,uuid,boolean,integer,text,text) to service_role;
notify pgrst,'reload schema';
commit;
