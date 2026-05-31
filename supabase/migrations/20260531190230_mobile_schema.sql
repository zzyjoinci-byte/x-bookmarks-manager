create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  x_user_id text not null unique,
  x_username text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists oauth_tokens (
  user_id uuid primary key references app_users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists mobile_oauth_states (
  state text primary key,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists mobile_login_codes (
  code_hash text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists mobile_sessions (
  token_hash text primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists bookmarks (
  user_id uuid not null references app_users(id) on delete cascade,
  id text not null,
  text text not null default '',
  author_id text not null default '',
  author_name text not null default '',
  author_username text not null default '',
  created_at timestamptz,
  category text not null default 'uncategorized',
  media_urls jsonb not null default '[]'::jsonb,
  local_media jsonb not null default '[]'::jsonb,
  bookmarked_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists bookmarks_user_created_idx on bookmarks(user_id, created_at desc nulls last);
create index if not exists bookmarks_user_category_idx on bookmarks(user_id, category);

create table if not exists category_rules (
  id bigserial primary key,
  user_id uuid references app_users(id) on delete cascade,
  category text not null,
  keywords text not null,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists category_rules_user_idx on category_rules(user_id, priority desc);

create table if not exists link_previews (
  user_id uuid not null references app_users(id) on delete cascade,
  url text not null,
  final_url text,
  title text,
  description text,
  image text,
  site_name text,
  excerpt text,
  status text not null default 'pending',
  fetched_at timestamptz not null default now(),
  primary key (user_id, url)
);
