import { firiFetchJson, firiTime, FiriRateLimiter } from './fetch'
import { fetchFiriMarkets } from './markets'
import type { FiriCreds } from './sign'
import { secureLogger } from '@/lib/utils/secure-logger'

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
  transactions: any[]
  deposits: any[]
  orders: any[]
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
  private markets: any

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
    secureLogger.info(`[Sync] Initialized with ${Object.keys(this.markets).length} markets`)
  }

  /**
   * Sync transactions with pagination
   */
  async syncTransactions(cursor: SyncCursor['transactions'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: any[]
    cursor: SyncCursor['transactions']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore || page >= this.options.maxPages) {
      return { data: [], cursor: { ...cursor, hasMore: false }, hasMore: false }
    }

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot()

    // Build query parameters for /v2/history/transactions
    const params = new URLSearchParams({
      count: String(this.options.batchSize)
    })

    if (lastId) {
      params.append('from_id', lastId)
    }

    secureLogger.info(`[Sync] Fetching transactions page ${page + 1}, from_id: ${lastId || 'start'}`)

    try {
      const transactions = await firiFetchJson<any[]>(
        `https://api.firi.com/v2/history/transactions?${params}`,
        this.creds
      )

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return { 
          data: [], 
          cursor: { ...cursor, hasMore: false, page: page + 1 }, 
          hasMore: false 
        }
      }

      // Enrich with market info
      const enrichedData = transactions.map(t => ({
        ...t,
        _marketInfo: t.market ? this.markets[t.market] : null
      }))

      // Update cursor
      const lastTransaction = transactions[transactions.length - 1]
      const newCursor: SyncCursor['transactions'] = {
        page: page + 1,
        lastId: lastTransaction.id?.toString() || null,
        hasMore: transactions.length === this.options.batchSize,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: enrichedData,
        cursor: newCursor,
        hasMore: newCursor.hasMore
      }

    } catch (error) {
      secureLogger.error(`[Sync] Error fetching transactions page ${page + 1}:`, error)
      throw error
    }
  }

  /**
   * Sync deposits with pagination
   */
  async syncDeposits(cursor: SyncCursor['deposits'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: any[]
    cursor: SyncCursor['deposits']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore || page >= this.options.maxPages) {
      return { data: [], cursor: { ...cursor, hasMore: false }, hasMore: false }
    }

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot()

    // Build query parameters for /v2/deposit/history
    const params = new URLSearchParams({
      count: String(this.options.batchSize)
    })

    if (lastId) {
      params.append('from_id', lastId)
    }

    secureLogger.info(`[Sync] Fetching deposits page ${page + 1}, from_id: ${lastId || 'start'}`)

    try {
      const deposits = await firiFetchJson<any[]>(
        `https://api.firi.com/v2/deposit/history?${params}`,
        this.creds
      )

      if (!Array.isArray(deposits) || deposits.length === 0) {
        return { 
          data: [], 
          cursor: { ...cursor, hasMore: false, page: page + 1 }, 
          hasMore: false 
        }
      }

      // Update cursor
      const lastDeposit = deposits[deposits.length - 1]
      const newCursor: SyncCursor['deposits'] = {
        page: page + 1,
        lastId: lastDeposit.id?.toString() || null,
        hasMore: deposits.length === this.options.batchSize,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: deposits,
        cursor: newCursor,
        hasMore: newCursor.hasMore
      }

    } catch (error) {
      secureLogger.error(`[Sync] Error fetching deposits page ${page + 1}:`, error)
      throw error
    }
  }

  /**
   * Sync orders with pagination
   */
  async syncOrders(cursor: SyncCursor['orders'] = { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }): Promise<{
    data: any[]
    cursor: SyncCursor['orders']
    hasMore: boolean
  }> {
    const { page, lastId, hasMore } = cursor
    
    if (!hasMore || page >= this.options.maxPages) {
      return { data: [], cursor: { ...cursor, hasMore: false }, hasMore: false }
    }

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot()

    // Build query parameters for /v2/orders/history
    const params = new URLSearchParams({
      count: String(this.options.batchSize)
    })

    if (lastId) {
      params.append('from_id', lastId)
    }

    secureLogger.info(`[Sync] Fetching orders page ${page + 1}, from_id: ${lastId || 'start'}`)

    try {
      const orders = await firiFetchJson<any[]>(
        `https://api.firi.com/v2/orders/history?${params}`,
        this.creds
      )

      if (!Array.isArray(orders) || orders.length === 0) {
        return { 
          data: [], 
          cursor: { ...cursor, hasMore: false, page: page + 1 }, 
          hasMore: false 
        }
      }

      // Enrich with market info
      const enrichedData = orders.map(o => ({
        ...o,
        _marketInfo: o.market ? this.markets[o.market] : null
      }))

      // Update cursor
      const lastOrder = orders[orders.length - 1]
      const newCursor: SyncCursor['orders'] = {
        page: page + 1,
        lastId: lastOrder.id?.toString() || null,
        hasMore: orders.length === this.options.batchSize,
        lastSyncAt: new Date().toISOString()
      }

      return {
        data: enrichedData,
        cursor: newCursor,
        hasMore: newCursor.hasMore
      }

    } catch (error) {
      secureLogger.error(`[Sync] Error fetching orders page ${page + 1}:`, error)
      throw error
    }
  }

  /**
   * Full sync that returns both data and cursors
   */
  async syncAll(existingCursor: Partial<SyncCursor> = {}): Promise<SyncResult> {
    await this.initialize()

    const progress: SyncProgress = {
      totalRaw: 0,
      totalNormalized: 0,
      transactions: { pages: 0, count: 0, hasMore: false },
      deposits: { pages: 0, count: 0, hasMore: false },
      orders: { pages: 0, count: 0, hasMore: false },
      hasMore: false,
      rateLimitStats: this.rateLimiter.getStats()
    }

    const newCursor: SyncCursor = {
      lastSync: new Date().toISOString()
    }

    // Collect all data
    const allTransactions: any[] = []
    const allDeposits: any[] = []
    const allOrders: any[] = []

    // Sync transactions
    secureLogger.info('[Sync] Starting transactions sync')
    let transactionCursor = existingCursor.transactions || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }
    
    while (transactionCursor.hasMore && transactionCursor.page < this.options.maxPages) {
      try {
        const result = await this.syncTransactions(transactionCursor)
        if (result.cursor) {
          progress.transactions.pages = result.cursor.page
          progress.transactions.count += result.data.length
          progress.totalRaw += result.data.length
          transactionCursor = result.cursor
          
          // Collect data
          allTransactions.push(...result.data)
          
          if (!result.hasMore) break
        }
        
        // Small delay between pages to be respectful
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        secureLogger.error('[Sync] Transaction sync error:', error)
        progress.lastError = error instanceof Error ? error.message : 'Unknown error'
        break
      }
    }
    
    newCursor.transactions = transactionCursor
    progress.transactions.hasMore = transactionCursor.hasMore

    // Sync deposits
    secureLogger.info('[Sync] Starting deposits sync')
    let depositCursor = existingCursor.deposits || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }
    
    while (depositCursor.hasMore && depositCursor.page < this.options.maxPages) {
      try {
        const result = await this.syncDeposits(depositCursor)
        if (result.cursor) {
          progress.deposits.pages = result.cursor.page
          progress.deposits.count += result.data.length
          progress.totalRaw += result.data.length
          depositCursor = result.cursor
          
          // Collect data
          allDeposits.push(...result.data)
          
          if (!result.hasMore) break
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        secureLogger.error('[Sync] Deposit sync error:', error)
        progress.lastError = error instanceof Error ? error.message : 'Unknown error'
        break
      }
    }
    
    newCursor.deposits = depositCursor
    progress.deposits.hasMore = depositCursor.hasMore

    // Sync orders
    secureLogger.info('[Sync] Starting orders sync')
    let orderCursor = existingCursor.orders || { page: 0, lastId: null, hasMore: true, lastSyncAt: new Date().toISOString() }
    
    while (orderCursor.hasMore && orderCursor.page < this.options.maxPages) {
      try {
        const result = await this.syncOrders(orderCursor)
        if (result.cursor) {
          progress.orders.pages = result.cursor.page
          progress.orders.count += result.data.length
          progress.totalRaw += result.data.length
          orderCursor = result.cursor
          
          // Collect data
          allOrders.push(...result.data)
          
          if (!result.hasMore) break
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        secureLogger.error('[Sync] Order sync error:', error)
        progress.lastError = error instanceof Error ? error.message : 'Unknown error'
        break
      }
    }
    
    newCursor.orders = orderCursor
    progress.orders.hasMore = orderCursor.hasMore

    // Update final progress
    progress.hasMore = progress.transactions.hasMore || progress.deposits.hasMore || progress.orders.hasMore
    progress.rateLimitStats = this.rateLimiter.getStats()

    return {
      transactions: allTransactions,
      deposits: allDeposits,
      orders: allOrders,
      cursors: newCursor,
      progress
    }
  }

  /**
   * Full sync that returns progress and cursor (legacy method)
   */
  async fullSync(existingCursor: Partial<SyncCursor> = {}): Promise<{
    progress: SyncProgress
    newCursor: SyncCursor
  }> {
    const result = await this.syncAll(existingCursor)
    return {
      progress: result.progress,
      newCursor: result.cursors
    }
  }

  /**
   * Get current rate limiter statistics
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
