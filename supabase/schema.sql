-- Default Zero — Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run

create extension if not exists pgcrypto;

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

-- Day Zero videos — one per user, locked once created
create table if not exists public.day_zero_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  video_url text not null,
  locked_at timestamptz default now()
);

-- Containers — no longer a hardcoded list in code. Defaults (user_id null) are visible to
-- everyone; custom ones belong to one user, either self-created or proposed by Socrates
-- after noticing a pattern in conversation that isn't covered by an existing container.
create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = default, shared by all users
  slug text not null,
  title text not null,
  icon text, -- Ionicons name used on the dashboard card
  source text not null default 'user', -- 'default' | 'user' | 'socrates'
  created_at timestamptz default now(),
  unique (user_id, slug)
);

insert into public.containers (user_id, slug, title, icon, source) values
  (null, 'money', 'Money', 'wallet-outline', 'default'),
  (null, 'physical', 'Physical', 'fitness-outline', 'default'),
  (null, 'spiritual', 'Spiritual', 'flame-outline', 'default'),
  (null, 'mind', 'Mind', 'bulb-outline', 'default'),
  (null, 'relationships', 'Relationships', 'heart-outline', 'default'),
  (null, 'emotions', 'Emotional Regulation', 'pulse-outline', 'default')
on conflict (user_id, slug) do nothing;

-- Life containers — logged entries (Money, Physical, Spiritual, Mind, etc.)
create table if not exists public.container_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  container_key text not null, -- references containers.slug (not a strict FK, to allow
                                -- deleted/renamed custom containers without orphaning history)
  title text not null,
  note text,
  created_at timestamptz default now()
);

-- Goals — general purpose, optionally linked to a container. Distinct from finance_goals
-- (which is Money-specific and tracks amounts); this is for any goal in any area of life.
create table if not exists public.life_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  container_key text, -- optional link, e.g. 'relationships' or a custom slug
  title text not null,
  description text,
  target_date date,
  status text not null default 'active', -- 'active' | 'completed' | 'abandoned'
  progress_percent int not null default 0,
  created_at timestamptz default now()
);

-- Mentorship lanes — both mentee requests AND mentor opt-ins live in this one table,
-- distinguished by role. A mentor row stays 'available' and can be matched to multiple
-- mentees up to max_mentees, rather than being consumed by a single match.
create table if not exists public.mentorship_lanes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'mentee', -- 'mentee' | 'mentor'
  container_key text, -- 'money' | 'physical' | 'spiritual' | 'mind' — null if this is a profession-based lane
  profession text, -- free text, e.g. "software engineer", "nurse", "electrician" — null if this is a container-based lane
  max_mentees int not null default 3, -- only meaningful when role = 'mentor'
  status text default 'pending', -- mentee: 'pending' | 'matched'. mentor: 'available' | 'paused'
  created_at timestamptz default now()
);

-- Mentor matches — confirmed pairings
create table if not exists public.mentor_matches (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid references auth.users(id) on delete cascade not null,
  mentor_id uuid references auth.users(id) on delete cascade,
  lane text not null, -- container key OR profession label, whichever this match is based on
  lane_type text not null default 'container', -- 'container' | 'profession'
  matched_at timestamptz default now()
);

-- Finance transactions — manual entries, M-Pesa STK deposits (confirmed via webhook), and
-- rows bulk-imported from a user's M-Pesa statement CSV.
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null,
  type text not null, -- 'income' | 'expense' | 'savings'
  category text, -- e.g. 'rent', 'transport', 'tithe', 'business', 'salary'
  source text not null default 'manual', -- 'manual' | 'mpesa_stk' | 'mpesa_statement'
  mpesa_receipt text, -- Safaricom receipt number, only set for source = 'mpesa_stk'
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Finance savings goals — progress is computed from finance_transactions where type = 'savings'
create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  target_amount numeric(12,2) not null,
  deadline date,
  created_at timestamptz default now()
);

-- Pending STK push requests — lets the webhook match an incoming confirmation back to
-- the right user and goal, since Daraja's callback doesn't carry your own user_id.
create table if not exists public.mpesa_stk_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  goal_id uuid references public.finance_goals(id) on delete set null,
  checkout_request_id text not null unique,
  amount numeric(12,2) not null,
  status text default 'pending', -- 'pending' | 'confirmed' | 'failed'
  created_at timestamptz default now()
);

-- Socrates AI chat history
create table if not exists public.socrates_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  reply text not null,
  created_at timestamptz default now()
);

-- Indexes — without these, container_entries and socrates_sessions get slower for every
-- user as row counts grow, since every query filters by user_id (and often container_key).
create index if not exists idx_container_entries_user on public.container_entries(user_id);
create index if not exists idx_container_entries_user_container on public.container_entries(user_id, container_key);
create index if not exists idx_socrates_sessions_user on public.socrates_sessions(user_id);
create index if not exists idx_mentorship_lanes_user on public.mentorship_lanes(user_id);
create index if not exists idx_finance_transactions_user on public.finance_transactions(user_id);
create index if not exists idx_finance_transactions_user_occurred on public.finance_transactions(user_id, occurred_at desc);
create index if not exists idx_finance_goals_user on public.finance_goals(user_id);
create index if not exists idx_mpesa_stk_checkout on public.mpesa_stk_requests(checkout_request_id);
create index if not exists idx_containers_user on public.containers(user_id);
create index if not exists idx_life_goals_user on public.life_goals(user_id);

-- Push notification tokens — one per user, overwritten on re-registration
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  push_token text not null,
  updated_at timestamptz default now()
);

-- Row Level Security — users can only see/edit their own rows
alter table public.profiles enable row level security;
alter table public.day_zero_videos enable row level security;
alter table public.container_entries enable row level security;
alter table public.mentorship_lanes enable row level security;
alter table public.mentor_matches enable row level security;
alter table public.socrates_sessions enable row level security;
alter table public.push_tokens enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_goals enable row level security;
alter table public.mpesa_stk_requests enable row level security;
alter table public.containers enable row level security;
alter table public.life_goals enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "own day zero video" on public.day_zero_videos
  for all using (auth.uid() = user_id);

create policy "own container entries" on public.container_entries
  for all using (auth.uid() = user_id);

create policy "own mentorship requests" on public.mentorship_lanes
  for all using (auth.uid() = user_id);

create policy "own mentor matches" on public.mentor_matches
  for select using (auth.uid() = mentee_id or auth.uid() = mentor_id);

create policy "own socrates sessions" on public.socrates_sessions
  for all using (auth.uid() = user_id);

create policy "own push token" on public.push_tokens
  for all using (auth.uid() = user_id);

create policy "own finance transactions" on public.finance_transactions
  for all using (auth.uid() = user_id);

create policy "own finance goals" on public.finance_goals
  for all using (auth.uid() = user_id);

create policy "own stk requests" on public.mpesa_stk_requests
  for all using (auth.uid() = user_id);

create policy "containers visible to owner or defaults to everyone" on public.containers
  for select using (user_id is null or auth.uid() = user_id);

create policy "users manage their own custom containers" on public.containers
  for insert with check (auth.uid() = user_id);

create policy "users update their own custom containers" on public.containers
  for update using (auth.uid() = user_id);

create policy "users delete their own custom containers" on public.containers
  for delete using (auth.uid() = user_id);

create policy "own life goals" on public.life_goals
  for all using (auth.uid() = user_id);

-- Storage bucket for Day Zero videos (run separately if this errors — buckets are sometimes created via Dashboard -> Storage instead)
insert into storage.buckets (id, name, public, file_size_limit) values ('day-zero-videos', 'day-zero-videos', false, 157286400)
on conflict (id) do nothing;
