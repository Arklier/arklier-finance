export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto/secrets'
import { fromPgBytea } from '@/lib/crypto/pg-bytea'
import { FiriSyncManager } from '@/lib/firi/sync'
import { FiriDataProcessor } from '@/lib/firi/data-processor'
import { fetchFiriMarkets } from '@/lib/firi/markets'
import { firiTime } from '@/lib/firi/fetch'
import type { MarketsMap } from '@/lib/firi/markets'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Get user's Firi connection
    const { data: conn, error: connErr } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('exchange', 'firi')
      .single()

    if (connErr || !conn) {
      return NextResponse.json({ error: 'no-connection' }, { status: 400 })
    }

    // Decrypt the API secret
    let secretPlain: string
    try {
      const blob = fromPgBytea(conn.api_secret)
      secretPlain = decryptSecret(blob)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'decrypt-failed', detail: msg }, { status: 500 })
    }

    // Create service client for database operations
    const serviceClient = createServiceClient()

    // Initialize sync manager
    const syncManager = new FiriSyncManager({
      apiKey: conn.api_key,
      clientId: conn.client_id,
      secretPlain
    })

    // Initialize data processor
    const dataProcessor = new FiriDataProcessor(
      serviceClient,
      user.id,
      conn.id
    )

    // Get server time and markets
    const serverTime = await firiTime()
    const markets = await fetchFiriMarkets({
      apiKey: conn.api_key,
      clientId: conn.client_id,
      secretPlain
    }, serverTime)

    // Initialize sync manager
    await syncManager.initialize()

    // Perform full sync - use syncAll to get the actual data arrays
    const syncResult = await syncManager.syncAll()

    // Process and store the synced data
    const processingResult = await dataProcessor.processAllData(
      syncResult.transactions,
      syncResult.deposits,
      syncResult.orders,
      {
        transactions: syncResult.cursors.transactions,
        deposits: syncResult.cursors.deposits,
        orders: syncResult.cursors.orders
      },
      Object.fromEntries(
        Object.entries(markets).map(([marketId, market]) => [
          marketId,
          {
            base: market.base,
            quote: market.quote,
            market: marketId
          }
        ])
      )
    )

    // Update connection with last sync info
    await serviceClient
      .from('exchange_connections')
      .update({ 
        updated_at: new Date().toISOString(),
        // You could add a last_sync_at field here if you want to track sync timing
      })
      .eq('id', conn.id)

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      sync: {
        transactions: syncResult.progress.transactions.count,
        deposits: syncResult.progress.deposits.count,
        orders: syncResult.progress.orders.count,
        total: syncResult.progress.totalRaw
      },
      processing: {
        raw: processingResult.totalRaw,
        normalized: processingResult.totalNormalized,
        errors: processingResult.errors
      },
      rateLimit: syncManager.getRateLimitStats()
    })

  } catch (error) {
    console.error('[Firi Sync] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json({
      error: 'sync-failed',
      detail: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 })
  }
}
