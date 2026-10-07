-- Database-enforced write budgets. Email-based, not an IP/WAF substitute.
begin;
set local lock_timeout='3s';
create schema if not exists scoutcard_internal;
revoke all on schema scoutcard_internal from public, anon, authenticated;
create index if not exists card_orders_email_recent_idx on public.card_orders(email,created_at desc);
create index if not exists coach_messages_email_recent_idx on public.coach_messages(coach_email,created_at desc);

create or replace function scoutcard_internal.limit_order_inserts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('order-budget:'||pg_catalog.lower(new.email),0));
 if (select count(*) from public.card_orders where email=pg_catalog.lower(new.email) and created_at>pg_catalog.now()-interval '1 hour')>=5 then
   raise sqlstate 'P0001' using message='Too many order requests. Please wait an hour before starting another order.';
 end if;
 return new;
end $$;
revoke all on function scoutcard_internal.limit_order_inserts() from public,anon,authenticated;
drop trigger if exists scoutcard_order_budget on public.card_orders;
create trigger scoutcard_order_budget before insert on public.card_orders for each row execute function scoutcard_internal.limit_order_inserts();

create or replace function scoutcard_internal.limit_message_inserts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('message-budget:'||pg_catalog.lower(new.coach_email),0));
 if (select count(*) from public.coach_messages where coach_email=pg_catalog.lower(new.coach_email) and created_at>pg_catalog.now()-interval '1 hour')>=10 then
   raise sqlstate 'P0001' using message='Too many messages. Please wait an hour before sending another message.';
 end if;
 return new;
end $$;
revoke all on function scoutcard_internal.limit_message_inserts() from public,anon,authenticated;
drop trigger if exists scoutcard_message_budget on public.coach_messages;
create trigger scoutcard_message_budget before insert on public.coach_messages for each row execute function scoutcard_internal.limit_message_inserts();
commit;
