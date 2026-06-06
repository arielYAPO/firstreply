-- Migration V2: Auth-based system with persistent tracker, credits, and payments
-- Run this in Supabase SQL Editor

-- Profiles (auto-created on first Google sign-in)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Credit balances
create table if not exists credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table credit_balances enable row level security;

create policy "Users can read own credits"
  on credit_balances for select
  using (auth.uid() = user_id);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'paypal',
  paypal_order_id text,
  paypal_capture_id text,
  amount_cents integer not null,
  currency text not null default 'EUR',
  status text not null,
  credits_granted integer not null default 0,
  created_at timestamptz not null default now()
);

alter table payments enable row level security;

create policy "Users can read own payments"
  on payments for select
  using (auth.uid() = user_id);

-- Applications (persistent tracker)
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company text,
  role text,
  contract_type text,
  location text,
  match_score integer,
  score_breakdown text,
  required_skills jsonb default '[]'::jsonb,
  candidate_strengths jsonb default '[]'::jsonb,
  candidate_weaknesses jsonb default '[]'::jsonb,
  status text default 'A contacter',
  next_action text,
  next_follow_up_date text,
  contact_to_find text,
  suggested_angle text,
  short_cover_letter text,
  direct_email text,
  linkedin_dm text,
  follow_up_j3 text,
  follow_up_j7 text,
  linkedin_profiles_to_search jsonb default '[]'::jsonb,
  search_queries jsonb default '[]'::jsonb,
  likely_email_patterns jsonb default '[]'::jsonb,
  next_action_type text,
  next_action_due_at timestamptz,
  sent_at timestamptz,
  followup_step text default 'none',
  won_at timestamptz,
  contact_name text,
  contact_role text,
  contact_domain text,
  offer_text text,
  profile_text text,
  evaluation jsonb,
  outreach jsonb,
  metadata jsonb
);

alter table applications enable row level security;

create policy "Users can read own applications"
  on applications for select
  using (auth.uid() = user_id);

create policy "Users can insert own applications"
  on applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own applications"
  on applications for update
  using (auth.uid() = user_id);

create policy "Users can delete own applications"
  on applications for delete
  using (auth.uid() = user_id);

-- Function to auto-create profile + credit_balances on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );
  insert into credit_balances (user_id, credits)
  values (new.id, 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
