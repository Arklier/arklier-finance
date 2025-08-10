-- Add sync status tracking fields to exchange_connections
-- This migration adds fields needed for comprehensive sync status tracking

alter table exchange_connections 
add column if not exists sync_status text default 'idle' check (sync_status in ('idle', 'syncing', 'completed', 'error')),
add column if not exists sync_error text,
add column if not exists sync_metadata jsonb default '{}'::jsonb;

-- Add index for sync status queries
create index if not exists idx_exchange_connections_sync_status 
on exchange_connections(user_id, exchange, sync_status, last_synced_at);

-- Add comments for documentation
comment on column exchange_connections.sync_status is 'Current sync status: idle, syncing, completed, or error';
comment on column exchange_connections.sync_error is 'Error message from last failed sync attempt';
comment on column exchange_connections.sync_metadata is 'JSON metadata from sync operations including cursors and statistics';
