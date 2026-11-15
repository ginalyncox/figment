-- AI video site: database tables (Postgres / Neon)
-- Run once:  psql "$DATABASE_URL" -f db/schema.sql

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  created_at timestamptz not null default now(),

  -- viewer subscription (kept in sync by the Stripe webhook)
  stripe_customer_id text unique,
  sub_status text,                 -- active, trialing, past_due, canceled, ...
  sub_plan text,                   -- weekly or monthly
  sub_period_end timestamptz,

  -- creator
  is_creator boolean not null default false,
  stripe_account_id text unique,   -- Stripe Connect account
  payouts_enabled boolean not null default false,
  license_version text,            -- which Creator License Agreement they accepted
  license_accepted_at timestamptz,
  license_accepted_ip text
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references users(id),
  title text not null,
  description text not null default '',
  ai_tools text not null default '',          -- which AI tools were used (shown to viewers)
  rights_confirmed_at timestamptz not null,   -- creator ticked the rights box
  status text not null default 'uploading'
    check (status in ('uploading','processing','pending_review','published','removed')),
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  removed_reason text
);
create index if not exists videos_status_idx on videos(status, published_at desc);

-- One row per viewer per free video. Counting rows = free videos used.
create table if not exists free_views (
  viewer_key text not null,        -- "u:<user id>" or "a:<anonymous cookie id>"
  video_id uuid not null references videos(id),
  created_at timestamptz not null default now(),
  primary key (viewer_key, video_id)
);

-- Seconds watched by PAYING subscribers, per video per month. Drives creator pay.
create table if not exists watch_time (
  user_id uuid not null references users(id),
  video_id uuid not null references videos(id),
  month date not null,             -- first day of the month (UTC)
  seconds integer not null default 0,
  last_beat_at timestamptz not null default now(),
  primary key (user_id, video_id, month)
);

-- One row per successful Stripe charge. Money in.
create table if not exists revenue (
  charge_id text primary key,
  stripe_customer_id text,
  gross_cents integer not null,
  fee_cents integer not null default 0,       -- Stripe processing fee
  refunded_cents integer not null default 0,
  created_at timestamptz not null
);

-- Monthly creator payouts. Money out.
create table if not exists payout_runs (
  month date primary key,
  net_revenue_cents integer not null,
  platform_fee_cents integer not null,
  creator_pool_cents integer not null,
  total_watch_seconds bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists payout_items (
  month date not null references payout_runs(month),
  creator_id uuid not null references users(id),
  watch_seconds bigint not null,
  amount_cents integer not null,
  status text not null default 'pending'
    check (status in ('pending','paid','held','failed')),
  stripe_transfer_id text,
  note text,
  primary key (month, creator_id)
);

-- Takedown and removal requests (copyright, intimate image, likeness, other).
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('copyright','intimate_image','likeness','other')),
  video_url text not null,
  reporter_name text not null,
  reporter_email text not null,
  details text not null,
  signature text not null,
  good_faith boolean not null,
  status text not null default 'open' check (status in ('open','removed','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Webhook events already handled, so a repeat delivery is ignored.
create table if not exists processed_events (
  id text primary key,
  created_at timestamptz not null default now()
);
