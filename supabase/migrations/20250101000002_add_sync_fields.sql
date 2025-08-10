-- Add sync tracking fields to exchange_connections
-- This migration adds fields needed for reliable sync operations

alter table exchange_connections 
add column if not exists last_synced_at timestamptz,
add column if not exists sync_cursor jsonb default '{}'::jsonb;

-- Add index for sync queries
create index if not exists idx_exchange_connections_sync 
on exchange_connections(user_id, exchange, last_synced_at);

-- Add comment for documentation
comment on column exchange_connections.last_synced_at is 'Timestamp of last successful sync operation';
comment on column exchange_connections.sync_cursor is 'JSON state for resuming sync operations (e.g., pagination cursors)';
