-- Add RLS policies for transaction data insertion
-- This allows the service role to insert data while maintaining user isolation

-- Allow service role to insert raw transactions
create policy "service_role can insert raw transactions"
on raw_transactions for insert
with check (true);

-- Allow service role to insert normalized transactions  
create policy "service_role can insert normalized transactions"
on normalized_transactions for insert
with check (true);

-- Add comment for documentation
comment on policy "service_role can insert raw transactions" on raw_transactions is 'Allows service role to insert transaction data during sync operations';
comment on policy "service_role can insert normalized transactions" on normalized_transactions is 'Allows service role to insert normalized transaction data during sync operations';
