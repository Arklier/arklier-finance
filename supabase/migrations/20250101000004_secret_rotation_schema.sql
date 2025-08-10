-- Secret Rotation Schema Migration
-- This migration adds support for automatic secret rotation and versioning

-- 1) Secret rotation policies and configuration
create table if not exists secret_rotation_policies (
  id uuid primary key default gen_random_uuid(),
  secret_type text not null check (secret_type in ('api_key', 'api_secret', 'encryption_key', 'jwt_secret')),
  rotation_interval_days integer not null default 90,
  max_age_days integer not null default 365,
  auto_rotation_enabled boolean not null default true,
  require_manual_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (secret_type)
);

-- 2) Secret versions tracking
create table if not exists secret_versions (
  id uuid primary key default gen_random_uuid(),
  secret_type text not null check (secret_type in ('api_key', 'api_secret', 'encryption_key', 'jwt_secret')),
  version_number integer not null,
  secret_hash text not null, -- hash of the secret for integrity checking
  encrypted_secret bytea not null, -- the actual encrypted secret
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  rotated_at timestamptz,
  rotated_by uuid references auth.users(id),
  metadata jsonb default '{}'::jsonb,
  unique (secret_type, version_number)
);

-- 3) Rotation history and audit trail
create table if not exists secret_rotation_history (
  id uuid primary key default gen_random_uuid(),
  secret_type text not null,
  old_version_id uuid references secret_versions(id),
  new_version_id uuid references secret_versions(id),
  rotation_method text not null check (rotation_method in ('automatic', 'manual', 'emergency')),
  rotation_reason text,
  rotated_by uuid references auth.users(id),
  rotated_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);

-- 4) Secret rotation schedules
create table if not exists secret_rotation_schedules (
  id uuid primary key default gen_random_uuid(),
  secret_type text not null,
  next_rotation_date timestamptz not null,
  last_rotation_attempt timestamptz,
  rotation_status text not null default 'pending' check (rotation_status in ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  attempts_count integer not null default 0,
  max_attempts integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (secret_type)
);

-- 5) Helpful indexes
create index if not exists idx_secret_versions_type_active on secret_versions(secret_type, is_active);
create index if not exists idx_secret_versions_expires on secret_versions(expires_at) where expires_at is not null;
create index if not exists idx_rotation_history_type on secret_rotation_history(secret_type, rotated_at);
create index if not exists idx_rotation_schedules_next on secret_rotation_schedules(next_rotation_date, rotation_status);

-- 6) RLS policies
alter table secret_rotation_policies enable row level security;
alter table secret_versions enable row level security;
alter table secret_rotation_history enable row level security;
alter table secret_rotation_schedules enable row level security;

-- Only service role can manage rotation policies
create policy "service_role_manages_rotation_policies"
on secret_rotation_policies for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Only service role can manage secret versions
create policy "service_role_manages_secret_versions"
on secret_versions for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Only service role can manage rotation history
create policy "service_role_manages_rotation_history"
on secret_rotation_history for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Only service role can manage rotation schedules
create policy "service_role_manages_rotation_schedules"
on secret_rotation_schedules for all
using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 7) Insert default rotation policies
insert into secret_rotation_policies (secret_type, rotation_interval_days, max_age_days, auto_rotation_enabled, require_manual_approval) values
  ('api_key', 90, 365, true, false),
  ('api_secret', 90, 365, true, false),
  ('encryption_key', 365, 1095, true, true), -- encryption keys rotated yearly, require approval
  ('jwt_secret', 180, 730, true, false)
on conflict (secret_type) do nothing;

-- 8) Functions for secret rotation
create or replace function rotate_secret(
  p_secret_type text,
  p_new_encrypted_secret bytea,
  p_rotation_method text default 'automatic',
  p_rotation_reason text default null
) returns uuid as $$
declare
  v_new_version_id uuid;
  v_old_version_id uuid;
  v_next_version_number integer;
  v_rotation_history_id uuid;
begin
  -- Get next version number
  select coalesce(max(version_number), 0) + 1
  into v_next_version_number
  from secret_versions
  where secret_type = p_secret_type;
  
  -- Deactivate current active version
  update secret_versions
  set is_active = false, rotated_at = now()
  where secret_type = p_secret_type and is_active = true
  returning id into v_old_version_id;
  
  -- Create new version
  insert into secret_versions (
    secret_type,
    version_number,
    secret_hash,
    encrypted_secret,
    is_active,
    created_at,
    expires_at
  ) values (
    p_secret_type,
    v_next_version_number,
    encode(sha256(p_new_encrypted_secret), 'hex'),
    p_new_encrypted_secret,
    true,
    now(),
    now() + interval '1 year'
  ) returning id into v_new_version_id;
  
  -- Record rotation history
  insert into secret_rotation_history (
    secret_type,
    old_version_id,
    new_version_id,
    rotation_method,
    rotation_reason,
    rotated_at
  ) values (
    p_secret_type,
    v_old_version_id,
    v_new_version_id,
    p_rotation_method,
    p_rotation_reason,
    now()
  ) returning id into v_rotation_history_id;
  
  -- Update rotation schedule
  update secret_rotation_schedules
  set 
    next_rotation_date = now() + (select rotation_interval_days || ' days'::interval from secret_rotation_policies where secret_type = p_secret_type),
    last_rotation_attempt = now(),
    rotation_status = 'completed',
    updated_at = now()
  where secret_type = p_secret_type;
  
  return v_new_version_id;
end;
$$ language plpgsql security definer;

-- 9) Function to get current active secret
create or replace function get_active_secret(p_secret_type text)
returns bytea as $$
declare
  v_secret bytea;
begin
  select encrypted_secret
  into v_secret
  from secret_versions
  where secret_type = p_secret_type and is_active = true
  limit 1;
  
  return v_secret;
end;
$$ language plpgsql security definer;

-- 10) Function to check if rotation is needed
create or replace function check_rotation_needed(p_secret_type text)
returns boolean as $$
declare
  v_needs_rotation boolean;
  v_policy record;
  v_current_secret record;
begin
  -- Get rotation policy
  select * into v_policy
  from secret_rotation_policies
  where secret_type = p_secret_type;
  
  if not found then
    return false;
  end if;
  
  -- Get current active secret
  select * into v_current_secret
  from secret_versions
  where secret_type = p_secret_type and is_active = true
  limit 1;
  
  if not found then
    return true; -- No active secret, needs rotation
  end if;
  
  -- Check if rotation is needed based on age
  v_needs_rotation := (
    v_current_secret.created_at + (v_policy.rotation_interval_days || ' days'::interval) < now() or
    (v_current_secret.expires_at is not null and v_current_secret.expires_at < now())
  );
  
  return v_needs_rotation;
end;
$$ language plpgsql security definer;
