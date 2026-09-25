-- SCOUTCARD reliability migration. Safe to rerun; no sample profiles or codes.
begin;
create table if not exists public.athlete_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 slug text unique not null check (slug ~ '^[a-z0-9-]{3,60}$'),
 display_name text not null, sport text, graduation_year text, position text,
 accolade text, highlight_url text, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.athlete_profiles add column if not exists details jsonb not null default '{}';
alter table public.athlete_profiles add column if not exists is_public boolean not null default false;
create table if not exists public.athlete_cards (
 id uuid primary key default gen_random_uuid(), activation_code text unique not null,
 profile_id uuid references public.athlete_profiles(id) on delete set null, activated_at timestamptz
);
alter table public.athlete_cards add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists athlete_cards_public_token_idx on public.athlete_cards(public_token);
create index if not exists athlete_cards_profile_idx on public.athlete_cards(profile_id);
create table if not exists public.coach_messages (
 id uuid primary key default gen_random_uuid(), profile_id uuid references public.athlete_profiles(id) on delete cascade,
 coach_name text not null, coach_email text not null, message text not null, created_at timestamptz default now()
);
create index if not exists coach_messages_inbox_idx on public.coach_messages(profile_id,created_at desc);
create table if not exists public.card_orders (
 id uuid primary key default gen_random_uuid(), customer_name text not null, email text not null,
 shipping_address text not null, status text not null default 'payment_pending', created_at timestamptz default now()
);
-- Table access: owners edit their own profile, see only their own inbox/cards.
alter table public.athlete_profiles enable row level security;
alter table public.athlete_cards enable row level security;
alter table public.coach_messages enable row level security;
alter table public.card_orders enable row level security;
revoke all on public.athlete_profiles, public.athlete_cards, public.coach_messages, public.card_orders from anon, authenticated;
grant select on public.athlete_profiles to anon, authenticated;
grant insert, update on public.athlete_profiles to authenticated;
grant select(id,public_token,profile_id,activated_at) on public.athlete_cards to authenticated;
grant select on public.coach_messages to authenticated;
drop policy if exists "public profiles are visible" on public.athlete_profiles;
drop policy if exists "users create own profile" on public.athlete_profiles;
drop policy if exists "users update own profile" on public.athlete_profiles;
drop policy if exists "owners can view cards" on public.athlete_cards;
drop policy if exists "owners activate cards" on public.athlete_cards;
drop policy if exists "coaches can message" on public.coach_messages;
drop policy if exists "owners read messages" on public.coach_messages;
drop policy if exists "customers can reserve cards" on public.card_orders;
create policy "public profiles are visible" on public.athlete_profiles for select using (is_public or id=(select auth.uid()));
create policy "users create own profile" on public.athlete_profiles for insert to authenticated with check (id=(select auth.uid()));
create policy "users update own profile" on public.athlete_profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy "owners can view cards" on public.athlete_cards for select to authenticated using (profile_id=(select auth.uid()));
create policy "owners read messages" on public.coach_messages for select to authenticated using (profile_id=(select auth.uid()));

create or replace function public.validate_scoutcard_profile()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.slug is distinct from old.slug then
   raise exception 'Your permanent profile address cannot be changed.';
 end if;
 if char_length(trim(new.display_name)) not between 1 and 60
   or char_length(coalesce(trim(new.sport),'')) not between 1 and 40
   or coalesce(new.graduation_year,'') !~ '^20[0-9]{2}$'
   or char_length(coalesce(new.position,''))>80 or char_length(coalesce(new.accolade,''))>200
   or char_length(coalesce(new.highlight_url,''))>1000
   or (coalesce(new.highlight_url,'')<>'' and new.highlight_url !~ '^https?://')
   or jsonb_typeof(new.details) <> 'object' or octet_length(new.details::text)>40000
 then raise exception 'Please check your profile name, sport, year, and field lengths.'; end if;
 if exists (select 1 from jsonb_each(new.details) d where d.key not in ('team','stats','academics','events','bio') or jsonb_typeof(d.value)<>'string')
   or char_length(coalesce(new.details->>'team',''))>120
   or char_length(coalesce(new.details->>'stats',''))>2000
   or char_length(coalesce(new.details->>'academics',''))>1000
   or char_length(coalesce(new.details->>'events',''))>2000
   or char_length(coalesce(new.details->>'bio',''))>1500
 then raise exception 'Please shorten the profile details to the allowed lengths.'; end if;
 new.updated_at=now();
 return new;
end; $$;
drop trigger if exists validate_scoutcard_profile on public.athlete_profiles;
create trigger validate_scoutcard_profile before insert or update on public.athlete_profiles for each row execute function public.validate_scoutcard_profile();
revoke all on function public.validate_scoutcard_profile() from public,anon,authenticated;

-- Only this function can claim cards. The claim is atomic, and repeating your own code succeeds.
create or replace function public.activate_athlete_card(card_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare account_id uuid:=auth.uid(); changed integer;
begin
 if account_id is null then raise exception 'Sign in before activating a card.'; end if;
 if not exists(select 1 from public.athlete_profiles where id=account_id) then raise exception 'Save your athlete profile before activating a card.'; end if;
 if card_code is null or char_length(trim(card_code)) not between 8 and 100 then return false; end if;
 update public.athlete_cards set profile_id=account_id,activated_at=coalesce(activated_at,now())
 where activation_code=upper(trim(card_code)) and (profile_id is null or profile_id=account_id);
 get diagnostics changed=row_count;
 return changed=1;
end; $$;
revoke all on function public.activate_athlete_card(text) from public,anon,authenticated;
grant execute on function public.activate_athlete_card(text) to authenticated;

-- Public card tokens are different from the private activation secret.
create or replace function public.resolve_scoutcard(card_token uuid)
returns text language sql stable security definer set search_path='' as $$
 select p.slug from public.athlete_cards c join public.athlete_profiles p on p.id=c.profile_id
 where c.public_token=card_token and p.is_public limit 1;
$$;
revoke all on function public.resolve_scoutcard(uuid) from public,anon,authenticated;
grant execute on function public.resolve_scoutcard(uuid) to anon,authenticated;

-- Coach contact is an inbox message, not an email delivery promise.
create or replace function public.send_coach_message(athlete_id uuid,sender_name text,sender_email text,message_text text)
returns boolean language plpgsql security definer set search_path='' as $$
declare normalized_email text:=lower(trim(sender_email));
begin
 if coalesce(char_length(trim(sender_name)),0) not between 2 and 100
 or coalesce(char_length(normalized_email),0) not between 3 and 254
 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or coalesce(char_length(trim(message_text)),0) not between 10 and 2000
 then raise exception 'Enter your name, a valid email, and a message of 10–2000 characters.'; end if;
 if not exists(select 1 from public.athlete_profiles where id=athlete_id and is_public) then raise exception 'This athlete profile is not accepting messages.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(athlete_id::text||normalized_email,0));
 if exists(select 1 from public.coach_messages where profile_id=athlete_id and coach_email=normalized_email and created_at>now()-interval '1 minute')
 then raise exception 'Please wait a minute before sending another message to this athlete.'; end if;
 insert into public.coach_messages(profile_id,coach_name,coach_email,message) values(athlete_id,trim(sender_name),normalized_email,trim(message_text));
 return true;
end; $$;
revoke all on function public.send_coach_message(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.send_coach_message(uuid,text,text,text) to anon,authenticated;

-- An unguessable client request ID makes retrying safe. It is also sent to Stripe.
-- No browser caller can read shipping records or set an order to paid.
create or replace function public.reserve_scoutcard_order(request_id uuid,customer_name text,customer_email text,delivery_address text)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.card_orders%rowtype; normalized_email text:=lower(trim(customer_email));
begin
 if request_id is null or coalesce(char_length(trim(customer_name)),0) not between 2 and 100
 or coalesce(char_length(normalized_email),0) not between 3 and 254
 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 or coalesce(char_length(trim(delivery_address)),0) not between 6 and 500
 then raise exception 'Enter your name, a valid email, and your full shipping address.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text,0));
 select * into previous from public.card_orders where id=request_id;
 if found then
   if previous.customer_name<>trim(customer_name) or previous.email<>normalized_email or previous.shipping_address<>trim(delivery_address)
   then raise exception 'Order details changed. Please start a new checkout.'; end if;
   if previous.status<>'payment_pending' then raise exception 'This order is already being processed. Please contact support before ordering again.'; end if;
   return request_id;
 end if;
 insert into public.card_orders(id,customer_name,email,shipping_address,status)
 values(request_id,trim(customer_name),normalized_email,trim(delivery_address),'payment_pending');
 return request_id;
end; $$;
revoke all on function public.reserve_scoutcard_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_scoutcard_order(uuid,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
