/**
 * Firi → normalized_transactions mapper (pure functions only).
 * No DB or network calls here; just shape/transform data.
 */

/* =========================
 * Types
 * =======================*/

export type RawRow = {
  id: number
  kind: 'history.transaction' | 'deposit' | 'order' | string
  payload: {
    currency?: string
    amount?: string | number
    transaction_hash?: string
    details?: {
      match_id?: string | number
      withdraw_id?: string | number
      withdraw_txid?: string
      deposit_id?: string | number
      deposit_txid?: string
    }
    type?: string
    [key: string]: unknown
  }
  occurred_at: string | null
}

export type NormalizedInsert = {
  // NOTE: user_id & connection_id are added at call-site (API route / processor).
  user_id: string
  connection_id: string
  source_raw_id: number

  txn_type:
    | 'buy'
    | 'sell'
    | 'deposit'
    | 'withdrawal'
    | 'send'
    | 'transfer'
    | 'staking'
    | 'bonus'
    | 'fee'
    | 'rebate'
    | 'trade_match'

  base_asset: string | null
  base_amount: number | null
  quote_asset: string | null
  quote_amount: number | null
  fee_asset: string | null
  fee_amount: number | null
  price: number | null
  txid: string | null
  order_id: string | null
  occurred_at: string
  metadata: unknown
}

export type RawTransaction = {
  id: number
  payload: unknown
  kind: string
  occurred_at: string | null
}

export type OrderWithMarket = {
  id: string
  side: 'bid' | 'ask'
  market: string
  price: number
  amount: number
  _marketInfo?: {
    base: string
    quote: string
  } | null
}

export type MarketInfo = {
  base: string
  quote: string
}

/* =========================
 * Utilities
 * =======================*/

function when(ts?: string | null): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString()
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function absNum(v: unknown): number | null {
  const n = numOrNull(v)
  return n === null ? null : Math.abs(n)
}

/* =========================
 * Enrichment helpers
 * =======================*/

/**
 * Enrich `trade_match` rows using order data and market mapping.
 * - Sets base/quote assets
 * - Computes signed base_amount & quote_amount from user perspective
 * - Sets price from the order
 * Fees are left for mergeFees().
 */
export function enrichTradeMatches(
  tradeMatches: Omit<NormalizedInsert, 'user_id' | 'connection_id'>[],
  orders: OrderWithMarket[],
  markets: { [marketId: string]: MarketInfo }
): Omit<NormalizedInsert, 'user_id' | 'connection_id'>[] {
  if (!tradeMatches?.length) return tradeMatches

  const byOrderId = new Map<string, OrderWithMarket>()
  for (const o of orders || []) {
    if (!o?.id) continue
    // Ensure market info exists
    const m = o._marketInfo ?? (o.market ? markets[o.market] ?? null : null) ?? null
    byOrderId.set(String(o.id), {
      ...o,
      _marketInfo: m,
    })
  }

  return tradeMatches.map((trade) => {
    if (trade.txn_type !== 'trade_match' || !trade.order_id) return trade

    const order = byOrderId.get(String(trade.order_id))
    if (!order || !order._marketInfo) return trade

    const { base, quote } = order._marketInfo
    const isBuy = order.side === 'bid'
    const amt = absNum(order.amount) ?? 0
    const price = numOrNull(order.price)
    const quoteAmt = price !== null ? amt * price : null

    return {
      ...trade,
      base_asset: base ?? trade.base_asset ?? null,
      base_amount: isBuy ? +amt : -amt,
      quote_asset: quote ?? trade.quote_asset ?? null,
      quote_amount: quoteAmt === null ? trade.quote_amount ?? null : (isBuy ? -quoteAmt : +quoteAmt),
      price: price ?? trade.price ?? null,
    }
  })
}

/**
 * Merge separate fee rows into their associated trades.
 * Current strategy:
 * - Group rows by `order_id`
 * - Sum `fee.fee_amount` (if missing, use abs(base_amount) when txn_type === 'fee')
 * - Attach fee_asset (first non-null or trade quote_asset)
 * - Remove fee rows from the array (since merged)
 *
 * The second argument (rawTransactions) is accepted for future use
 * (e.g., correlation via raw payloads), but not used yet.
 */
export function mergeFees(
  normalized: Omit<NormalizedInsert, 'user_id' | 'connection_id'>[],
  _rawTransactions: RawTransaction[]
): Omit<NormalizedInsert, 'user_id' | 'connection_id'>[] {
  if (!normalized?.length) return normalized

  const result = [...normalized]
  const groups = new Map<
    string,
    { tradeIdxs: number[]; feeIdxs: number[] }
  >()

  // Index by order_id
  result.forEach((tx, idx) => {
    if (!tx.order_id) return
    if (!groups.has(tx.order_id)) groups.set(tx.order_id, { tradeIdxs: [], feeIdxs: [] })
    const g = groups.get(tx.order_id)!
    if (tx.txn_type === 'fee') g.feeIdxs.push(idx)
    else if (tx.txn_type === 'trade_match' || tx.txn_type === 'buy' || tx.txn_type === 'sell') g.tradeIdxs.push(idx)
  })

  // Merge fees into the first trade-like row
  const toRemove: number[] = []

  groups.forEach(({ tradeIdxs, feeIdxs }) => {
    if (!tradeIdxs.length || !feeIdxs.length) return

    const mainTradeIdx = tradeIdxs[0]
    const main = result[mainTradeIdx]

    // Collect fee totals & asset
    let feeTotal = 0
    let feeAsset: string | null = main.fee_asset ?? main.quote_asset ?? null

    feeIdxs.forEach((fi) => {
      const f = result[fi]
      // Prefer explicit fee_amount; else derive from base_amount magnitude if present
      const explicit = numOrNull(f.fee_amount)
      const derived = f.base_amount != null ? Math.abs(Number(f.base_amount)) : null
      const add = explicit ?? derived ?? 0
      feeTotal += add
      if (!feeAsset && f.fee_asset) feeAsset = f.fee_asset
      toRemove.push(fi)
    })

    result[mainTradeIdx] = {
      ...main,
      fee_asset: feeAsset,
      fee_amount: (numOrNull(main.fee_amount) ?? 0) + feeTotal,
    }
  })

  // Remove merged fee rows (descending indices to keep positions valid)
  toRemove
    .sort((a, b) => b - a)
    .forEach((idx) => {
      if (idx >= 0 && idx < result.length) result.splice(idx, 1)
    })

  return result
}

/* =========================
 * Primary mapper
 * =======================*/

/**
 * Map a single raw Firi row → normalized insert (without user/connection).
 * Route code should add user_id + connection_id before upsert.
 *
 * NOTE:
 * - Trade rows with match_id are emitted as `trade_match` with placeholders.
 *   Enrich later using orders + markets.
 */
export function normalizeFiri(
  raw: RawRow
): Omit<NormalizedInsert, 'user_id' | 'connection_id'> | null {
  const p = raw.payload ?? {}
  const occurred = when(raw.occurred_at)
  const kind = String(raw.kind)

  if (kind === 'deposit') {
    return {
      source_raw_id: raw.id,
      txn_type: 'deposit',
      base_asset: p.currency ?? null,
      base_amount: absNum(p.amount),
      quote_asset: null,
      quote_amount: null,
      fee_asset: null,
      fee_amount: null,
      price: null,
      txid: p.transaction_hash ?? null,
      order_id: null,
      occurred_at: occurred,
      metadata: p,
    }
  }

  if (kind === 'history.transaction') {
    const details = p.details ?? {}

    // Matched trade (to enrich later)
    if (details.match_id != null) {
      return {
        source_raw_id: raw.id,
        txn_type: 'trade_match',
        base_asset: null,
        base_amount: null,
        quote_asset: null,
        quote_amount: null,
        fee_asset: null,
        fee_amount: null,
        price: null,
        txid: null,
        order_id: String(details.match_id),
        occurred_at: occurred,
        metadata: p,
      }
    }

    // Withdrawal
    if (details.withdraw_id != null) {
      return {
        source_raw_id: raw.id,
        txn_type: 'withdrawal',
        base_asset: p.currency ?? null,
        base_amount: (() => {
          const n = absNum(p.amount)
          return n === null ? null : -n // outflow
        })(),
        quote_asset: null,
        quote_amount: null,
        fee_asset: null,
        fee_amount: null,
        price: null,
        txid: details.withdraw_txid ?? null,
        order_id: null,
        occurred_at: occurred,
        metadata: p,
      }
    }

    // Some deposits may appear in history.transaction
    if (details.deposit_id != null) {
      return {
        source_raw_id: raw.id,
        txn_type: 'deposit',
        base_asset: p.currency ?? null,
        base_amount: absNum(p.amount),
        quote_asset: null,
        quote_amount: null,
        fee_asset: null,
        fee_amount: null,
        price: null,
        txid: details.deposit_txid ?? null,
        order_id: null,
        occurred_at: occurred,
        metadata: p,
      }
    }

    // Fees / bonuses / rebates
    const t = String(p.type ?? '').toLowerCase()
    if (t === 'fee') {
      // Represent fee as its own row (negative base_amount), fee_amount positive
      const amt = absNum(p.amount)
      return {
        source_raw_id: raw.id,
        txn_type: 'fee',
        base_asset: p.currency ?? null,
        base_amount: amt === null ? null : -amt,
        quote_asset: null,
        quote_amount: null,
        fee_asset: p.currency ?? null,
        fee_amount: amt,
        price: null,
        txid: null,
        order_id: p.order_id ? String(p.order_id) : null, // if present in payload
        occurred_at: occurred,
        metadata: p,
      }
    }

    if (t === 'bonus' || t === 'rebate') {
      return {
        source_raw_id: raw.id,
        txn_type: t as 'bonus' | 'rebate',
        base_asset: p.currency ?? null,
        base_amount: absNum(p.amount), // inflow
        quote_asset: null,
        quote_amount: null,
        fee_asset: null,
        fee_amount: null,
        price: null,
        txid: null,
        order_id: p.order_id ? String(p.order_id) : null,
        occurred_at: occurred,
        metadata: p,
      }
    }
  }

  if (kind === 'order') {
    // Use _marketInfo populated by the sync layer (avoid naive string slicing)
    const side = String(p.side ?? '').toLowerCase() as 'bid' | 'ask'
    const price = numOrNull(p.price)
    const amount = numOrNull(p.amount)
    const m = p._marketInfo as { base?: string; quote?: string } | null

    const base = m?.base ?? null
    const quote = m?.quote ?? null
    const isBuy = side === 'bid'

    return {
      source_raw_id: raw.id,
      txn_type: isBuy ? 'buy' : 'sell',
      base_asset: base,
      base_amount:
        amount === null ? null : isBuy ? Math.abs(amount) : -Math.abs(amount),
      quote_asset: quote,
      quote_amount:
        amount !== null && price !== null
          ? isBuy
            ? -Math.abs(amount * price)
            : Math.abs(amount * price)
          : null,
      fee_asset: quote,
      fee_amount: null, // merged later if fees are separate rows
      price: price,
      txid: null,
      order_id: p.id != null ? String(p.id) : null,
      occurred_at: when(raw.occurred_at),
      metadata: p,
    }
  }

  return null
}
