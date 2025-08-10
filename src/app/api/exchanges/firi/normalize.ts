type RawRow = { id: number, kind: string, payload: any, occurred_at: string | null, /* ... */ }

export function normalizeFiri(raw: RawRow) {
  const p = raw.payload
  const occurred = raw.occurred_at ? new Date(raw.occurred_at).toISOString() : new Date().toISOString()

  // Heuristics based on Firi payloads visible in docs:
  // - /v2/history/transactions item has: id, amount, currency, type, date, details{ match_id, deposit_id, withdraw_id, ... }
  // - /v2/history/orders contains side/market/price/amount/date
  // We'll map by presence of details.* or kind.

  if (raw.kind === 'deposit') {
    return {
      user_id: undefined as any,            // filled in route before insert; this module can be pure
      connection_id: undefined as any,
      source_raw_id: raw.id,
      txn_type: 'deposit',
      base_asset: p.currency ?? null,
      base_amount: Number(p.amount ?? 0),
      quote_asset: null,
      quote_amount: null,
      fee_asset: null,
      fee_amount: null,
      price: null,
      txid: p.transaction_hash ?? null,
      order_id: null,
      occurred_at: occurred,
      metadata: p
    }
  }

  // Generic transaction
  if (raw.kind === 'history.transaction') {
    const details = p.details || {}
    // If it's a matched trade (details.match_id present), we produce a trade_match with base/quote inferred later via orders lookup.
    if (details.match_id) {
      return {
        user_id: undefined as any,
        connection_id: undefined as any,
        source_raw_id: raw.id,
        txn_type: 'trade_match',
        base_asset: null,    // optional: derive from linked order market (e.g., BTC)
        base_amount: null,   // derive by linking against orders payload and amount_currency
        quote_asset: null,
        quote_amount: null,
        fee_asset: null,
        fee_amount: null,
        price: null,
        txid: null,
        order_id: String(details.match_id),
        occurred_at: occurred,
        metadata: p
      }
    }
    if (details.withdraw_id) {
      return {
        user_id: undefined as any,
        connection_id: undefined as any,
        source_raw_id: raw.id,
        txn_type: 'withdrawal',
        base_asset: p.currency ?? null,
        base_amount: -Math.abs(Number(p.amount ?? 0)),
        occurred_at: occurred,
        quote_asset: null, quote_amount: null, fee_asset: null, fee_amount: null,
        price: null, txid: details.withdraw_txid ?? null, order_id: null,
        metadata: p
      }
    }
    if (details.deposit_id) {
      return {
        user_id: undefined as any,
        connection_id: undefined as any,
        source_raw_id: raw.id,
        txn_type: 'deposit',
        base_asset: p.currency ?? null,
        base_amount: Math.abs(Number(p.amount ?? 0)),
        occurred_at: occurred,
        quote_asset: null, quote_amount: null, fee_asset: null, fee_amount: null,
        price: null, txid: details.deposit_txid ?? null, order_id: null,
        metadata: p
      }
    }
    // Fallback: fee/bonus/etc. by 'type' string if provided
    const t = String(p.type ?? '').toLowerCase()
    const map: Record<string, any> = {
      'fee': 'fee',
      'bonus': 'bonus'
    }
    const mtype = map[t]
    if (mtype) {
      return {
        user_id: undefined as any,
        connection_id: undefined as any,
        source_raw_id: raw.id,
        txn_type: mtype,
        base_asset: p.currency ?? null,
        base_amount: Number(p.amount ?? 0),
        quote_asset: null, quote_amount: null,
        fee_asset: null, fee_amount: null,
        price: null, txid: null, order_id: null,
        occurred_at: occurred,
        metadata: p
      }
    }
  }

  if (raw.kind === 'order') {
    // Optional: produce normalized buy/sell from closed order record if matched and amounts are final
    const side = String(raw.payload.side ?? '').toLowerCase() // 'bid' | 'ask'
    const amt = Number(raw.payload.amount ?? 0)
    const pr = Number(raw.payload.price ?? 0)
    const market: string = raw.payload.market ?? '' // e.g., 'BTCNOK'
    const base = market.slice(0, 3) // naive; replace with real map
    const quote = market.slice(3)

    const txn_type = side === 'bid' ? 'buy' : 'sell'
    return {
      user_id: undefined as any,
      connection_id: undefined as any,
      source_raw_id: raw.id,
      txn_type,
      base_asset: base,
      base_amount: side === 'bid' ? Math.abs(amt) : -Math.abs(amt),
      quote_asset: quote,
      quote_amount: side === 'bid' ? -Math.abs(amt * pr) : Math.abs(amt * pr),
      fee_asset: quote,
      fee_amount: null, // compute from separate fee row if present
      price: pr,
      txid: null,
      order_id: String(raw.payload.id ?? ''),
      occurred_at: raw.occurred_at ?? new Date().toISOString(),
      metadata: raw.payload
    }
  }

  return null
}
