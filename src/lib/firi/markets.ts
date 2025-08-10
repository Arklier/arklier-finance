import { firiFetchJson, firiTime } from './fetch'
import type { FiriCreds } from './sign'
import { makeFiriHeaders } from './sign'
import { secureLogger } from '@/lib/utils/secure-logger'

export interface FiriMarket {
  id: string
  base: string
  quote: string
  tickSize: number
  minQty: number
  name: string
  status: string
  // Additional fields from Firi API
  baseAsset?: string
  quoteAsset?: string
  marketType?: string
  isActive?: boolean
}

export interface MarketsMap {
  [marketId: string]: FiriMarket
}

// In-memory cache for markets with TTL
let marketsCache: MarketsMap | null = null
let cacheExpiry: number = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (increased for stability)

// Cache statistics for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  lastFetch: null as Date | null,
  fetchCount: 0
}

/**
 * Fetch markets from Firi API /v2/markets endpoint
 * This is the authoritative source for market information
 */
export async function fetchFiriMarkets(creds: FiriCreds, serverTime: number): Promise<MarketsMap> {
  // Check cache first
  if (marketsCache && Date.now() < cacheExpiry) {
    cacheStats.hits++
    secureLogger.info(`[Markets] Cache hit, returning ${Object.keys(marketsCache).length} cached markets`)
    return marketsCache
  }

  cacheStats.misses++
  secureLogger.info(`[Markets] Cache miss, fetching fresh markets from API`)

  try {
    const headers = makeFiriHeaders(creds, serverTime, 60)
    const response = await fetch('https://api.firi.com/v2/markets', { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Transform the response into our standardized format
    const markets: MarketsMap = {}
    
    if (Array.isArray(data)) {
      for (const market of data) {
        // Only include markets with valid ID, base, and quote
        if (market.id && market.base && market.quote) {
          markets[market.id] = {
            id: market.id,
            base: market.base,
            quote: market.quote,
            tickSize: market.tickSize || 0.00000001,
            minQty: market.minQty || 0.00000001,
            name: market.name || `${market.base}/${market.quote}`,
            status: market.status || 'active',
            baseAsset: market.baseAsset || market.base,
            quoteAsset: market.quoteAsset || market.quote,
            marketType: market.marketType || 'spot',
            isActive: market.isActive !== false
          }
        } else {
          console.warn(`[Markets] Skipping invalid market data:`, market)
        }
      }
    } else {
      throw new Error('Invalid markets response format: expected array')
    }

    // Update cache
    marketsCache = markets
    cacheExpiry = Date.now() + CACHE_TTL
    cacheStats.lastFetch = new Date()
    cacheStats.fetchCount++
    
    secureLogger.info(`[Markets] Successfully fetched ${Object.keys(markets).length} markets, cache updated`)
    
    return markets
  } catch (error) {
    console.error('[Markets] Error fetching Firi markets:', error)
    
    // Return cached data if available, even if expired
    if (marketsCache) {
      console.log(`[Markets] Returning stale cache due to fetch error`)
      return marketsCache
    }
    
    // If no cache available, throw error
    throw new Error(`Failed to fetch markets and no cache available: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get market info by market ID from cache
 * Returns null if market not found or cache is empty
 */
export function getMarketInfo(marketId: string): FiriMarket | null {
  if (!marketsCache) {
    return null
  }
  
  const market = marketsCache[marketId]
  if (!market) {
    console.warn(`[Markets] Market not found: ${marketId}`)
    return null
  }
  
  return market
}

/**
 * Get base and quote assets for a market ID
 * This is the primary method for getting asset information
 */
export function getMarketAssets(marketId: string): { base: string; quote: string } | null {
  const market = getMarketInfo(marketId)
  if (!market) {
    return null
  }
  
  return {
    base: market.base,
    quote: market.quote
  }
}

/**
 * Get all available markets from cache
 * Returns empty object if cache is empty
 */
export function getAllMarkets(): MarketsMap {
  return marketsCache || {}
}

/**
 * Get market IDs for a specific base asset
 */
export function getMarketsByBase(baseAsset: string): string[] {
  if (!marketsCache) return []
  
  return Object.keys(marketsCache).filter(marketId => {
    const market = marketsCache![marketId]
    return market.base === baseAsset
  })
}

/**
 * Get market IDs for a specific quote asset
 */
export function getMarketsByQuote(quoteAsset: string): string[] {
  if (!marketsCache) return []
  
  return Object.keys(marketsCache).filter(marketId => {
    const market = marketsCache![marketId]
    return market.quote === quoteAsset
  })
}

/**
 * Check if a market exists and is active
 */
export function isMarketActive(marketId: string): boolean {
  const market = getMarketInfo(marketId)
  return market?.isActive === true && market?.status === 'active'
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    ...cacheStats,
    cacheSize: marketsCache ? Object.keys(marketsCache).length : 0,
    cacheAge: marketsCache && cacheStats.lastFetch 
      ? Date.now() - cacheStats.lastFetch.getTime() 
      : null,
    isExpired: Date.now() >= cacheExpiry
  }
}

/**
 * Clear the markets cache
 * Useful for testing or when cache becomes stale
 */
export function clearMarketsCache(): void {
  marketsCache = null
  cacheExpiry = 0
  cacheStats.lastFetch = null
  console.log('[Markets] Cache cleared')
}

/**
 * Force refresh the markets cache
 * Useful when you need fresh data immediately
 */
export async function refreshMarketsCache(creds: FiriCreds): Promise<MarketsMap> {
  console.log('[Markets] Force refreshing cache')
  clearMarketsCache()
  const serverTime = Math.floor(Date.now() / 1000) // Use client time as fallback
  return fetchFiriMarkets(creds, serverTime)
}
