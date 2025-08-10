import type { Database } from '@/types/database'

// Define proper types for Firi API responses
export interface FiriTransaction {
  id: string
  market_id: string
  side: 'buy' | 'sell'
  amount: string
  price: string
  fee: string
  timestamp: string
  order_id?: string
}

export interface FiriDeposit {
  id: string
  currency: string
  amount: string
  timestamp: string
  status: string
}

export interface FiriOrder {
  id: string
  market_id: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  amount: string
  price?: string
  status: string
  timestamp: string
}

export interface MarketInfo {
  base: string
  quote: string
  market: string
}

type RawRow = { 
  id: number, 
  kind: string, 
  payload: unknown, 
  occurred_at: string | null
}

export function normalizeFiri(raw: RawRow) {
  const { kind, payload } = raw
  
  switch (kind) {
    case 'match':
      return normalizeMatch(payload as unknown as FiriTransaction)
    case 'withdraw':
      return normalizeWithdraw(payload as unknown as FiriDeposit)
    case 'deposit':
      return normalizeDeposit(payload as unknown as FiriDeposit)
    case 'order':
      return normalizeOrder(payload as unknown as FiriOrder)
    default:
      return null
  }
}

function normalizeMatch(payload: FiriTransaction) {
  const { id, market_id, side, amount, price, fee, timestamp, order_id } = payload
  
  return {
    id: `match_${id}`,
    type: 'match' as const,
    market_id,
    side,
    amount: parseFloat(amount),
    price: parseFloat(price),
    fee: parseFloat(fee),
    timestamp: new Date(timestamp),
    order_id: order_id || null,
    raw: payload
  }
}

function normalizeWithdraw(payload: FiriDeposit) {
  const { id, currency, amount, timestamp, status } = payload
  
  return {
    id: `withdraw_${id}`,
    type: 'withdraw' as const,
    currency,
    amount: parseFloat(amount),
    timestamp: new Date(timestamp),
    status,
    raw: payload
  }
}

function normalizeDeposit(payload: FiriDeposit) {
  const { id, currency, amount, timestamp, status } = payload
  
  return {
    id: `deposit_${id}`,
    type: 'deposit' as const,
    currency,
    amount: parseFloat(amount),
    timestamp: new Date(timestamp),
    status,
    raw: payload
  }
}

function normalizeOrder(payload: FiriOrder) {
  const { id, market_id, side, type, amount, price, status, timestamp } = payload
  
  return {
    id: `order_${id}`,
    type: 'order' as const,
    market_id,
    side,
    order_type: type,
    amount: parseFloat(amount),
    price: price ? parseFloat(price) : null,
    status,
    timestamp: new Date(timestamp),
    raw: payload
  }
}
