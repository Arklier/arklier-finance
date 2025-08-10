import { NextRequest, NextResponse } from 'next/server'
import { decryptSecret } from '@/lib/crypto/secrets'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { FiriSyncManager } from '@/lib/firi/sync'
import { FiriDataProcessor } from '@/lib/firi/data-processor'
import { fetchFiriMarkets } from '@/lib/firi/markets'
import { secureLogger } from '@/lib/utils/secure-logger'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let userId: string = ''
  let connectionId: string = ''
  
  try {
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      secureLogger.audit({
        action: 'FIRI_SYNC_PARSE_FAILED',
        resource: '/api/exchanges/firi/sync',
        success: false,
        error: 'Invalid request body',
        metadata: { parseError: parseError instanceof Error ? parseError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { connectionId: connId } = body
    if (!connId) {
      secureLogger.audit({
        action: 'FIRI_SYNC_INVALID_REQUEST',
        resource: '/api/exchanges/firi/sync',
        success: false,
        error: 'Missing connectionId',
        metadata: { body }
      })
      
      return NextResponse.json(
        { error: 'Missing connectionId' },
        { status: 400 }
      )
    }

    connectionId = connId

    // Get current user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      secureLogger.audit({
        action: 'FIRI_SYNC_AUTH_FAILED',
        resource: '/api/exchanges/firi/sync',
        success: false,
        error: 'User not authenticated',
        metadata: { authError: authError?.message }
      })
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    userId = user.id

    // Get connection details
    const { data: conn, error: connError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('id', connId)
      .eq('user_id', user.id)
      .single()

    // Check if connection is active
    if (!conn) {
      secureLogger.audit({
        action: 'FIRI_SYNC_CONNECTION_NOT_FOUND',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Connection not found',
        metadata: { connectionId: connId }
      })
      
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 400 }
      )
    }

    // Check if connection has valid credentials
    if (!conn.api_key || !conn.client_id || !conn.api_secret) {
      secureLogger.audit({
        action: 'FIRI_SYNC_INVALID_CREDENTIALS',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Connection missing required credentials',
        metadata: { connectionId: connId, hasApiKey: !!conn.api_key, hasClientId: !!conn.client_id, hasSecret: !!conn.api_secret }
      })
      
      return NextResponse.json(
        { error: 'Connection missing required credentials' },
        { status: 400 }
      )
    }

    // Get API credentials
    let apiKey: string
    let apiSecret: string
    let clientId: string
    
    try {
      apiKey = await decryptSecret(conn.api_key_encrypted)
      apiSecret = await decryptSecret(conn.api_secret_encrypted)
      clientId = conn.client_id
    } catch (decryptError) {
      secureLogger.error('Failed to decrypt API credentials', decryptError)
      
      secureLogger.audit({
        action: 'FIRI_SYNC_DECRYPT_FAILED',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Failed to decrypt API credentials',
        metadata: { connectionId: connId, decryptError: decryptError instanceof Error ? decryptError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Failed to decrypt API credentials' },
        { status: 500 }
      )
    }

    // Create Firi credentials object
    const firiCreds = {
      apiKey,
      clientId,
      secretPlain: apiSecret
    }

    // Fetch markets for data processing
    let markets
    try {
      const serverTime = Math.floor(Date.now() / 1000) // Current time in seconds
      markets = await fetchFiriMarkets(firiCreds, serverTime)
    } catch (marketsError) {
      secureLogger.error('Failed to fetch markets', marketsError)
      
      secureLogger.audit({
        action: 'FIRI_SYNC_MARKETS_FAILED',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Failed to fetch markets',
        metadata: { connectionId: connId, marketsError: marketsError instanceof Error ? marketsError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Failed to fetch markets' },
        { status: 500 }
      )
    }

    // Transform markets to match expected MarketInfo format
    const transformedMarkets: { [marketId: string]: { base: string; quote: string; market: string } } = {}
    Object.entries(markets).forEach(([marketId, market]) => {
      if (market && typeof market === 'object' && 'base' in market && 'quote' in market && 'id' in market) {
        transformedMarkets[marketId] = {
          base: market.base as string,
          quote: market.quote as string,
          market: market.id as string
        }
      }
    })

    // Create sync manager
    const syncManager = new FiriSyncManager(firiCreds)

    // Initialize sync manager
    try {
      await syncManager.initialize()
    } catch (initError) {
      secureLogger.error('Failed to initialize sync manager', initError)
      
      secureLogger.audit({
        action: 'FIRI_SYNC_INIT_FAILED',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Failed to initialize sync manager',
        metadata: { connectionId: connId, initError: initError instanceof Error ? initError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Failed to initialize sync manager' },
        { status: 500 }
      )
    }

    // Start sync process
    let result
    try {
      result = await syncManager.syncAll()
    } catch (syncError) {
      secureLogger.error('Failed to execute sync', syncError)
      
      secureLogger.audit({
        action: 'FIRI_SYNC_EXECUTION_FAILED',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Failed to execute sync',
        metadata: { connectionId: connId, syncError: syncError instanceof Error ? syncError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Failed to execute sync' },
        { status: 500 }
      )
    }

    // Process and store the synced data
    let processingResult
    try {
      // Create service client for data insertion operations
      const serviceClient = createServiceClient()
      
      // Create data processor with service client
      const dataProcessor = new FiriDataProcessor(
        serviceClient,
        userId,
        connId,
        { batchSize: 100 }
      )

      // Process all synced data
      processingResult = await dataProcessor.processAllData(
        result.transactions || [],
        result.deposits || [],
        result.orders || [],
        {
          transactions: result.cursors?.transactions,
          deposits: result.cursors?.deposits,
          orders: result.cursors?.orders
        },
        transformedMarkets
      )

      secureLogger.info(`[Sync] Data processing completed: ${processingResult.totalRaw} raw, ${processingResult.totalNormalized} normalized`)

      if (processingResult.errors.length > 0) {
        secureLogger.warn(`[Sync] Data processing had ${processingResult.errors.length} errors:`, processingResult.errors)
      }

    } catch (processingError) {
      secureLogger.error('Failed to process synced data', processingError)
      
      secureLogger.audit({
        action: 'FIRI_SYNC_PROCESSING_FAILED',
        resource: '/api/exchanges/firi/sync',
        userId,
        success: false,
        error: 'Failed to process synced data',
        metadata: { connectionId: connId, processingError: processingError instanceof Error ? processingError.message : 'Unknown error' }
      })
      
      return NextResponse.json(
        { error: 'Failed to process synced data' },
        { status: 500 }
      )
    }
    
    // Log successful sync
    secureLogger.audit({
      action: 'FIRI_SYNC_SUCCESS',
      resource: '/api/exchanges/firi/sync',
      userId,
      success: true,
      metadata: { 
        connectionId: connId,
        exchange: 'firi',
        marketsCount: Object.keys(markets).length,
        processingTime: Date.now() - startTime,
        progress: result.progress,
        dataProcessing: {
          totalRaw: processingResult.totalRaw,
          totalNormalized: processingResult.totalNormalized,
          errors: processingResult.errors.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      progress: result.progress,
      cursor: result.cursors,
      dataProcessing: {
        totalRaw: processingResult.totalRaw,
        totalNormalized: processingResult.totalNormalized,
        errors: processingResult.errors
      }
    })

  } catch (error) {
    // Log error without exposing secrets
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Firi sync failed', error)
    
    secureLogger.audit({
      action: 'FIRI_SYNC_ERROR',
      resource: '/api/exchanges/firi/sync',
      userId: userId || 'unknown',
      success: false,
      error: errorMessage,
      metadata: { 
        connectionId,
        processingTime: Date.now() - startTime 
      }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
