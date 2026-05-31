create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  active boolean not null default true,
  credits_limit integer not null default 30,
  credits_used integer not null default 0,
  buyer_note text,
  created_at timestamptz not null default now()
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  access_key text not null references access_keys(key) on delete cascade,
  company text,
  role text,
  output text,
  created_at timestamptz not null default now()
);

alter table access_keys enable row level security;
alter table generations enable row level security;

-- No public policies needed for V1.
-- Server-side API uses SUPABASE_SERVICE_ROLE_KEY.
