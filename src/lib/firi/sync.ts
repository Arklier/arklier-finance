import { firiFetchJson, firiTime, FiriRateLimiter } from './fetch'
import { fetchFiriMarkets, type MarketsMap } from './markets'
import type { FiriCreds } from './sign'


// Define proper types for Firi data
export interface FiriTransaction {
  id: string
  [key: string]: unknown
}

export interface FiriDeposit {
  id: string
  [key: string]: unknown
}

export interface FiriOrder {
  id: string
  [key: string]: unknown
}

export interface SyncCursor {
  transactions?: {
    page: number
    lastId: string | null
    hasMore: boolean
    lastSyncAt: string
  }
  deposits?: {
    page: number
    lastId: string | null
    hasMore: boolean
    lastSyncAt: string
  }
  orders?: {
    page: number
    lastId: string | null
    hasMore: boolean
    lastSyncAt: string
  }
  lastSync: string
}

export interface SyncProgress {
  totalRaw: number
  totalNormalized: number
  transactions: { pages: number; count: number; hasMore: boolean }
  deposits: { pages: number; count: number; hasMore: boolean }
  orders: { pages: number; count: number; hasMore: boolean }
  hasMore: boolean
  lastError?: string
  rateLimitStats: {
    currentRequests: number
    maxRequests: number
    windowMs: number
    delayMs: number
  }
}

export interface SyncOptions {
  batchSize?: number
  maxPages?: number
  maxConcurrent?: number
  rateLimitDelay?: number
}

const DEFAULT_OPTIONS: Required<SyncOptions> = {
  batchSize: 500,
  maxPages: 1000, // Increased for comprehensive backfill
  maxConcurrent: 1, // Sequential processing for rate limiting
  rateLimitDelay: 150
}

export interface SyncResult {
  transactions: FiriTransaction[]
  deposits: FiriDeposit[]
  orders: FiriOrder[]
  cursors: SyncCursor
  progress: SyncProgress
}

/**
 * Firi API Sync Manager
 * Handles pagination and rate limiting for all sync endpoints
 */
export class FiriSyncManager {
  private rateLimiter: FiriRateLimiter
  private options: Required<SyncOptions>
  private creds: FiriCreds
  private markets!: MarketsMap

  constructor(creds: FiriCreds, options: SyncOptions = {}) {
    this.creds = creds
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.rateLimiter = new FiriRateLimiter(6, 1000, this.options.rateLimitDelay)
  }

  /**
   * Initialize sync by fetching markets and server time
   */
  async initialize(): Promise<void> {
    const serverTime = await firiTime()
    this.markets = await fetchFiriMarkets(this.creds, serverTime)
    console.log(`[Sync] Initialized with ${Object.keys(this.markets).length} markets`)
  }

  /**
   * Sync transactions with pagination
   */
  async syncTransactions(cursor: SyncCursor['transactions'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: FiriTransaction[]
    cursor: SyncCursor['transactions']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore) {
      return { data: [], cursor, hasMore: false }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.options.batchSize.toString()
      })

      if (lastId) {
        params.append('since', lastId)
      }

      const transactions = await firiFetchJson<FiriTransaction[]>(
        `https://api.firi.com/v2/history/transactions?${params}`,
        this.creds
      )

      const hasMoreData = transactions.length === this.options.batchSize
      const newCursor: SyncCursor['transactions'] = {
        page: page + 1,
        lastId: transactions.length > 0 ? transactions[transactions.length - 1].id : lastId,
        hasMore: hasMoreData,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: transactions,
        cursor: newCursor,
        hasMore: hasMoreData
      }
    } catch (error) {
      console.error('[Sync] Failed to sync transactions', { error, cursor })
      throw error
    }
  }

  /**
   * Sync deposits with pagination
   */
  async syncDeposits(cursor: SyncCursor['deposits'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: FiriDeposit[]
    cursor: SyncCursor['deposits']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore) {
      return { data: [], cursor, hasMore: false }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.options.batchSize.toString()
      })

      if (lastId) {
        params.append('since', lastId)
      }

      const deposits = await firiFetchJson<FiriDeposit[]>(
        `https://api.firi.com/v2/deposit/history?${params}`,
        this.creds
      )

      const hasMoreData = deposits.length === this.options.batchSize
      const newCursor: SyncCursor['deposits'] = {
        page: page + 1,
        lastId: deposits.length > 0 ? deposits[deposits.length - 1].id : lastId,
        hasMore: hasMoreData,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: deposits,
        cursor: newCursor,
        hasMore: hasMoreData
      }
    } catch (error) {
      console.error('[Sync] Failed to sync deposits', { error, cursor })
      throw error
    }
  }

  /**
   * Sync orders with pagination
   */
  async syncOrders(cursor: SyncCursor['orders'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: FiriOrder[]
    cursor: SyncCursor['orders']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore) {
      return { data: [], cursor, hasMore: false }
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.options.batchSize.toString()
      })

      if (lastId) {
        params.append('since', lastId)
      }

      const orders = await firiFetchJson<FiriOrder[]>(
        `https://api.firi.com/v2/orders/history?${params}`,
        this.creds
      )

      const hasMoreData = orders.length === this.options.batchSize
      const newCursor: SyncCursor['orders'] = {
        page: page + 1,
        lastId: orders.length > 0 ? orders[orders.length - 1].id : lastId,
        hasMore: hasMoreData,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: orders,
        cursor: newCursor,
        hasMore: hasMoreData
      }
    } catch (error) {
      console.error('[Sync] Failed to sync orders', { error, cursor })
      throw error
    }
  }

  /**
   * Sync all data types with progress tracking
   */
  async syncAll(existingCursor: Partial<SyncCursor> = {}): Promise<SyncResult> {
    const cursor: SyncCursor = {
      transactions: existingCursor.transactions || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() },
      deposits: existingCursor.deposits || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() },
      orders: existingCursor.orders || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() },
      lastSync: existingCursor.lastSync || new Date().toISOString()
    }

    const progress: SyncProgress = {
      totalRaw: 0,
      totalNormalized: 0,
      transactions: { pages: 0, count: 0, hasMore: true },
      deposits: { pages: 0, count: 0, hasMore: true },
      orders: { pages: 0, count: 0, hasMore: true },
      hasMore: true,
      rateLimitStats: this.rateLimiter.getStats()
    }

    // Collect all data
    const allTransactions: FiriTransaction[] = []
    const allDeposits: FiriDeposit[] = []
    const allOrders: FiriOrder[] = []

    // Sync transactions
    while (cursor.transactions?.hasMore && progress.transactions.pages < this.options.maxPages) {
      try {
        const result = await this.syncTransactions(cursor.transactions)
        allTransactions.push(...result.data)
        cursor.transactions = result.cursor
        progress.transactions.pages++
        progress.transactions.count += result.data.length
        progress.transactions.hasMore = result.hasMore
        
        if (result.data.length > 0) {
          await this.rateLimiter.waitForSlot()
        }
      } catch (error) {
        progress.lastError = `Transaction sync failed: ${error}`
        break
      }
    }

    // Sync deposits
    while (cursor.deposits?.hasMore && progress.deposits.pages < this.options.maxPages) {
      try {
        const result = await this.syncDeposits(cursor.deposits)
        allDeposits.push(...result.data)
        cursor.deposits = result.cursor
        progress.deposits.pages++
        progress.deposits.count += result.data.length
        progress.deposits.hasMore = result.hasMore
        
        if (result.data.length > 0) {
          await this.rateLimiter.waitForSlot()
        }
      } catch (error) {
        progress.lastError = `Deposit sync failed: ${error}`
        break
      }
    }

    // Sync orders
    while (cursor.orders?.hasMore && progress.orders.pages < this.options.maxPages) {
      try {
        const result = await this.syncOrders(cursor.orders)
        allOrders.push(...result.data)
        cursor.orders = result.cursor
        progress.orders.pages++
        progress.orders.count += result.data.length
        progress.orders.hasMore = result.hasMore
        
        if (result.data.length > 0) {
          await this.rateLimiter.waitForSlot()
        }
      } catch (error) {
        progress.lastError = `Order sync failed: ${error}`
        break
      }
    }

    // Update progress
    progress.totalRaw = allTransactions.length + allDeposits.length + allOrders.length
    progress.hasMore = progress.transactions.hasMore || progress.deposits.hasMore || progress.orders.hasMore
    progress.rateLimitStats = this.rateLimiter.getStats()

    return {
      transactions: allTransactions,
      deposits: allDeposits,
      orders: allOrders,
      cursors: cursor,
      progress
    }
  }

  /**
   * Full sync with comprehensive backfill
   */
  async fullSync(existingCursor: Partial<SyncCursor> = {}): Promise<{
    progress: SyncProgress
    newCursor: SyncCursor
  }> {
    console.log('[Sync] Starting full sync...')
    
    const result = await this.syncAll(existingCursor)
    
    console.log('[Sync] Full sync completed', {
      transactions: result.progress.transactions.count,
      deposits: result.progress.deposits.count,
      orders: result.progress.orders.count,
      total: result.progress.totalRaw
    })
    
    return {
      progress: result.progress,
      newCursor: result.cursors
    }
  }

  /**
   * Get current rate limit statistics
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats()
  }

  /**
   * Reset rate limiter (useful for testing)
   */
  resetRateLimiter() {
    this.rateLimiter = new FiriRateLimiter(6, 1000, this.options.rateLimitDelay)
  }
}
