import { SupabaseClient } from '@supabase/supabase-js'
import { normalizeFiri } from '@/app/api/exchanges/firi/normalize'
import type { SyncCursor } from './sync'

// Define MarketInfo type locally since it's not exported from normalize.ts
export interface MarketInfo {
  base: string
  quote: string
  market: string
}

export interface ProcessedData {
  rawCount: number
  normalizedCount: number
  errors: string[]
}

export interface ProcessingOptions {
  batchSize?: number
  skipNormalization?: boolean
}

/**
 * Processes and stores synced Firi data in the database
 */
export class FiriDataProcessor {
  private supabase: SupabaseClient
  private userId: string
  private connectionId: string
  private options: Required<ProcessingOptions>

  constructor(
    supabase: SupabaseClient,
    userId: string,
    connectionId: string,
    options: ProcessingOptions = {}
  ) {
    this.supabase = supabase
    this.userId = userId
    this.connectionId = connectionId
    this.options = {
      batchSize: 100,
      skipNormalization: false,
      ...options
    }
  }

  /**
   * Enrich orders with market information
   */
  private enrichOrdersWithMarkets(orders: any[], markets: { [marketId: string]: MarketInfo }): any[] {
    return orders.map(order => ({
      ...order,
      _marketInfo: markets[order.market] || null
    }))
  }

  /**
   * Process and store transactions data
   */
  async processTransactions(
    transactions: any[],
    cursor: SyncCursor['transactions'],
    markets: { [marketId: string]: MarketInfo } = {}
  ): Promise<ProcessedData> {
    if (!transactions || transactions.length === 0) {
      return { rawCount: 0, normalizedCount: 0, errors: [] }
    }

    const errors: string[] = []
    let rawCount = 0
    let normalizedCount = 0

    try {
      const rawPayloads = transactions.map(t => ({
        user_id: this.userId,
        connection_id: this.connectionId,
        provider: 'firi',
        provider_tx_id: t.id?.toString() || null,
        kind: 'history.transaction',
        occurred_at: t.date ? new Date(t.date).toISOString() : null,
        payload: t
      }))

      const { data: inserted, error: insertError } = await this.supabase
        .from('raw_transactions')
        .upsert(rawPayloads, {
          onConflict: 'connection_id,provider,provider_tx_id,kind'
        })
        .select('id,payload,kind,occurred_at')

      if (insertError) {
        throw new Error(`Failed to insert raw transactions: ${insertError.message}`)
      }

      rawCount = inserted?.length || 0
      console.log(`[DataProcessor] Inserted ${rawCount} raw transactions`)

      if (!this.options.skipNormalization && inserted && inserted.length > 0) {
        const normalized = inserted
          .map((r: any) => normalizeFiri(r))
          .filter((n): n is NonNullable<typeof n> => n !== null)

        if (normalized.length > 0) {
          const enrichedNormalized = normalized.map(n => ({
            ...n,
            user_id: this.userId,
            connection_id: this.connectionId
          }))

          const { error: normError } = await this.supabase
            .from('normalized_transactions')
            .upsert(enrichedNormalized, {
              onConflict: 'source_raw_id'
            })

          if (normError) {
            throw new Error(`Failed to insert normalized transactions: ${normError.message}`)
          }

          normalizedCount = enrichedNormalized.length
          console.log(`[DataProcessor] Normalized and inserted ${normalizedCount} transactions`)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Transaction processing error: ${errorMsg}`)
      console.error('[DataProcessor] Error processing transactions:', error)
    }

    return { rawCount, normalizedCount, errors }
  }

  /**
   * Process and store deposits data
   */
  async processDeposits(
    deposits: any[],
    cursor: SyncCursor['deposits']
  ): Promise<ProcessedData> {
    if (!deposits || deposits.length === 0) {
      return { rawCount: 0, normalizedCount: 0, errors: [] }
    }

    const errors: string[] = []
    let rawCount = 0
    let normalizedCount = 0

    try {
      const rawPayloads = deposits.map(d => ({
        user_id: this.userId,
        connection_id: this.connectionId,
        provider: 'firi',
        provider_tx_id: String(d.id || ''),
        kind: 'deposit',
        occurred_at: d.deposited_at ? new Date(d.deposited_at).toISOString() : null,
        payload: d
      }))

      const { data: inserted, error: insertError } = await this.supabase
        .from('raw_transactions')
        .upsert(rawPayloads, {
          onConflict: 'connection_id,provider,provider_tx_id,kind'
        })
        .select('id,payload,kind,occurred_at')

      if (insertError) {
        throw new Error(`Failed to insert raw deposits: ${insertError.message}`)
      }

      rawCount = inserted?.length || 0
      console.log(`[DataProcessor] Inserted ${rawCount} raw deposits`)

      if (!this.options.skipNormalization && inserted && inserted.length > 0) {
        const normalized = inserted
          .map((r: any) => normalizeFiri(r))
          .filter((n): n is NonNullable<typeof n> => n !== null)

        if (normalized.length > 0) {
          const enrichedNormalized = normalized.map(n => ({
            ...n,
            user_id: this.userId,
            connection_id: this.connectionId
          }))

          const { error: normError } = await this.supabase
            .from('normalized_transactions')
            .upsert(enrichedNormalized, {
              onConflict: 'source_raw_id'
            })

          if (normError) {
            throw new Error(`Failed to insert normalized deposits: ${normError.message}`)
          }

          normalizedCount = enrichedNormalized.length
          console.log(`[DataProcessor] Normalized and inserted ${normalizedCount} deposits`)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Deposit processing error: ${errorMsg}`)
      console.error('[DataProcessor] Error processing deposits:', error)
    }

    return { rawCount, normalizedCount, errors }
  }

  /**
   * Process and store orders data
   */
  async processOrders(
    orders: any[],
    cursor: SyncCursor['orders'],
    markets: { [marketId: string]: MarketInfo } = {}
  ): Promise<ProcessedData> {
    if (!orders || orders.length === 0) {
      return { rawCount: 0, normalizedCount: 0, errors: [] }
    }

    const errors: string[] = []
    let rawCount = 0
    let normalizedCount = 0

    try {
      const enrichedOrders = this.enrichOrdersWithMarkets(orders, markets)

      const rawPayloads = enrichedOrders.map(o => ({
        user_id: this.userId,
        connection_id: this.connectionId,
        provider: 'firi',
        provider_tx_id: String(o.id || ''),
        kind: 'order',
        occurred_at: o.created_at ? new Date(o.created_at).toISOString() : null,
        payload: o
      }))

      const { data: inserted, error: insertError } = await this.supabase
        .from('raw_transactions')
        .upsert(rawPayloads, {
          onConflict: 'connection_id,provider,provider_tx_id,kind'
        })
        .select('id,payload,kind,occurred_at')

      if (insertError) {
        throw new Error(`Failed to insert raw orders: ${insertError.message}`)
      }

      rawCount = inserted?.length || 0
      console.log(`[DataProcessor] Inserted ${rawCount} raw orders`)

      if (!this.options.skipNormalization && inserted && inserted.length > 0) {
        const normalized = inserted
          .map((r: any) => normalizeFiri(r))
          .filter((n): n is NonNullable<typeof n> => n !== null)

        if (normalized.length > 0) {
          const enrichedNormalized = normalized.map(n => ({
            ...n,
            user_id: this.userId,
            connection_id: this.connectionId
          }))

          const { error: normError } = await this.supabase
            .from('normalized_transactions')
            .upsert(enrichedNormalized, {
              onConflict: 'source_raw_id'
            })

          if (normError) {
            throw new Error(`Failed to insert normalized orders: ${normError.message}`)
          }

          normalizedCount = enrichedNormalized.length
          console.log(`[DataProcessor] Normalized and inserted ${normalizedCount} orders`)
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Order processing error: ${errorMsg}`)
      console.error('[DataProcessor] Error processing orders:', error)
    }

    return { rawCount, normalizedCount, errors }
  }

  /**
   * Enrich trade matches and merge fees after all data is processed
   */
  async enrichAndMergeFees(
    markets: { [marketId: string]: MarketInfo }
  ): Promise<ProcessedData> {
    const errors: string[] = []
    let processedCount = 0

    try {
      const { data: tradeMatches, error: tmErr } = await this.supabase
        .from('normalized_transactions')
        .select('*')
        .eq('connection_id', this.connectionId)
        .eq('txn_type', 'trade_match')

      if (tmErr) throw new Error(`Failed to fetch trade matches: ${tmErr.message}`)
      if (!tradeMatches?.length) {
        console.log('[DataProcessor] No trade matches to enrich')
        return { rawCount: 0, normalizedCount: 0, errors: [] }
      }

      const { data: orderRows, error: ordersErr } = await this.supabase
        .from('raw_transactions')
        .select('payload')
        .eq('connection_id', this.connectionId)
        .eq('kind', 'order')

      if (ordersErr) throw new Error(`Failed to fetch orders: ${ordersErr.message}`)

      const orders = (orderRows ?? []).map((r: any) => {
        const o = r.payload || {}
        const m = o._marketInfo || (o.market ? markets[o.market] : null) || null
        return {
          id: String(o.id ?? ''),
          side: (String(o.side ?? '').toLowerCase() === 'bid' ? 'bid' : 'ask') as 'bid' | 'ask',
          market: String(o.market ?? ''),
          price: Number(o.price ?? 0),
          amount: Number(o.amount ?? 0),
          _marketInfo: m ? { base: m.base, quote: m.quote } : undefined,
        }
      })

      const enriched = tradeMatches as any[]

      const finalRows = enriched.map(tx => ({
        ...tx,
        base_asset: tx.base_asset ?? null,
        base_amount: tx.base_amount ?? null,
        quote_asset: tx.quote_asset ?? null,
        quote_amount: tx.quote_amount ?? null,
        fee_asset: tx.fee_asset ?? null,
        fee_amount: tx.fee_amount ?? null,
        price: tx.price ?? null,
      }))

      for (const tx of finalRows as any[]) {
        const { error: updErr } = await this.supabase
          .from('normalized_transactions')
          .update({
            base_asset: tx.base_asset ?? null,
            base_amount: tx.base_amount ?? null,
            quote_asset: tx.quote_asset ?? null,
            quote_amount: tx.quote_amount ?? null,
            fee_asset: tx.fee_asset ?? null,
            fee_amount: tx.fee_amount ?? null,
            price: tx.price ?? null,
          })
          .eq('source_raw_id', tx.source_raw_id)

        if (updErr) {
          errors.push(`Failed to update ${tx.source_raw_id}: ${updErr.message}`)
        } else {
          processedCount++
        }
      }

      console.log(`[DataProcessor] Enriched + merged fees for ${processedCount} trade matches`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      errors.push(`Enrichment error: ${msg}`)
      console.error('[DataProcessor] Error enriching trade matches:', e)
    }

    return { rawCount: 0, normalizedCount: processedCount, errors }
  }

  /**
   * Process all synced data in batches
   */
  async processAllData(
    transactions: any[],
    deposits: any[],
    orders: any[],
    cursors: {
      transactions?: SyncCursor['transactions']
      deposits?: SyncCursor['deposits']
      orders?: SyncCursor['orders']
    },
    markets: { [marketId: string]: MarketInfo } = {}
  ): Promise<{
    totalRaw: number
    totalNormalized: number
    errors: string[]
    details: {
      transactions: ProcessedData
      deposits: ProcessedData
      orders: ProcessedData
      enrichment: ProcessedData
    }
  }> {
    const [transactionsResult, depositsResult, ordersResult] = await Promise.all([
      this.processTransactions(transactions, cursors.transactions, markets),
      this.processDeposits(deposits, cursors.deposits),
      this.processOrders(orders, cursors.orders, markets)
    ])

    const enrichmentResult = await this.enrichAndMergeFees(markets)

    const totalRaw = transactionsResult.rawCount + depositsResult.rawCount + ordersResult.rawCount
    const totalNormalized =
      transactionsResult.normalizedCount +
      depositsResult.normalizedCount +
      ordersResult.normalizedCount +
      enrichmentResult.normalizedCount

    const allErrors = [
      ...transactionsResult.errors,
      ...depositsResult.errors,
      ...ordersResult.errors,
      ...enrichmentResult.errors
    ]

    return {
      totalRaw,
      totalNormalized,
      errors: allErrors,
      details: {
        transactions: transactionsResult,
        deposits: depositsResult,
        orders: ordersResult,
        enrichment: enrichmentResult
      }
    }
  }
}
