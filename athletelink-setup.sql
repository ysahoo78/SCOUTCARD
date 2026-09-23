create table if not exists public.athlete_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,60}$'), display_name text not null,
  sport text, graduation_year text, position text, accolade text, highlight_url text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.athlete_cards (
  id uuid primary key default gen_random_uuid(), activation_code text unique not null,
  profile_id uuid references public.athlete_profiles(id) on delete set null, activated_at timestamptz
);
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(), profile_id uuid references public.athlete_profiles(id) on delete cascade,
  coach_name text not null, coach_email text not null, message text not null, created_at timestamptz default now()
);
alter table public.athlete_profiles enable row level security; alter table public.athlete_cards enable row level security; alter table public.coach_messages enable row level security;
grant select,insert,update on public.athlete_profiles to anon,authenticated; grant insert on public.coach_messages to anon; grant select,update on public.athlete_cards to authenticated;
create policy "public profiles are visible" on public.athlete_profiles for select using (true);
create policy "users create own profile" on public.athlete_profiles for insert to authenticated with check (auth.uid()=id);
create policy "users update own profile" on public.athlete_profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
create policy "coaches can message" on public.coach_messages for insert to anon,authenticated with check (char_length(message) between 1 and 2000);
create policy "owners can view cards" on public.athlete_cards for select to authenticated using (profile_id=auth.uid());
create policy "owners activate cards" on public.athlete_cards for update to authenticated using (profile_id is null) with check (profile_id=auth.uid());
-- Replace this test code with a unique code printed on each real card.
insert into public.athlete_cards (activation_code) values ('ATHLETE-DEMO-2026') on conflict do nothing;
