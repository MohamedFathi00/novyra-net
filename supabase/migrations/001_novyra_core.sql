-- NOVYRA hosted foundation. Firebase data is intentionally untouched.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'NOVYRA User',
  language text not null default 'en' check (language in ('ar', 'en')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.monitoring_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro', 'business')),
  billing_cycle text not null default 'none' check (billing_cycle in ('monthly', 'annual', 'none')),
  status text not null default 'none',
  provider text not null default 'none',
  provider_customer_id text,
  provider_subscription_id text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists test_history_user_created_idx on public.test_history(user_id, created_at desc);
create index if not exists monitoring_snapshots_user_created_idx on public.monitoring_snapshots(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.test_history enable row level security;
alter table public.monitoring_snapshots enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists test_history_self_all on public.test_history;
create policy test_history_self_all on public.test_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists monitoring_snapshots_self_all on public.monitoring_snapshots;
create policy monitoring_snapshots_self_all on public.monitoring_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, 'NOVYRA User'), '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
