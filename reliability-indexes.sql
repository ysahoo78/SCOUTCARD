-- Additive indexes only. No rows or policies changed.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
create index if not exists coach_messages_page_idx on public.coach_messages(profile_id, created_at desc, id desc);
create index if not exists athlete_cards_page_idx on public.athlete_cards(profile_id, activated_at desc, id desc);
create index if not exists coach_messages_sender_recent_idx on public.coach_messages(profile_id, coach_email, created_at desc);
create index if not exists card_orders_pending_created_idx on public.card_orders(created_at) where status = 'payment_pending' and paid_at is null;
commit;
