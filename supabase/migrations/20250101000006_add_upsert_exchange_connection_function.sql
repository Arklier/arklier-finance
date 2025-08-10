-- Add stored procedure for upserting exchange connections with proper bytea handling
-- This ensures that the api_secret is properly stored as bytea instead of being serialized

CREATE OR REPLACE FUNCTION upsert_exchange_connection(
  p_user_id uuid,
  p_exchange text,
  p_api_key text,
  p_client_id text,
  p_api_secret text -- hex string that will be converted to bytea
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO exchange_connections (
    user_id,
    exchange,
    api_key,
    client_id,
    api_secret
  ) VALUES (
    p_user_id,
    p_exchange,
    p_api_key,
    p_client_id,
    decode(p_api_secret, 'hex') -- Convert hex string to bytea
  )
  ON CONFLICT (user_id, exchange)
  DO UPDATE SET
    api_key = EXCLUDED.api_key,
    client_id = EXCLUDED.client_id,
    api_secret = decode(p_api_secret, 'hex'), -- Convert hex string to bytea
    updated_at = now();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_exchange_connection TO authenticated;
