export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { FiriSyncManager } from '@/lib/firi/sync'
import { FiriDataProcessor } from '@/lib/firi/data-processor'
import { fetchFiriMarkets } from '@/lib/firi/markets'
import { firiTime } from '@/lib/firi/fetch'
import { z } from 'zod'
import type { MarketsMap } from '@/lib/firi/markets'

// Schema for sync request with fresh credentials
const SyncRequestSchema = z.object({
  apiKey: z.string().min(10),
  clientId: z.string().min(3),
  secret: z.string().min(10),
  connectionId: z.string().optional(), // Optional for existing connections
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Parse request body with fresh credentials
    const body = SyncRequestSchema.parse(await req.json())
    
    // Use fresh credentials directly instead of decrypting stored ones
    const freshCreds = {
      apiKey: body.apiKey,
      clientId: body.clientId,
      secretPlain: body.secret
    }

    // Create service client for database operations
    const serviceClient = createServiceClient()

    // Initialize sync manager with fresh credentials
    const syncManager = new FiriSyncManager(freshCreds)

    // Initialize data processor
    const dataProcessor = new FiriDataProcessor(
      serviceClient,
      user.id,
      body.connectionId || 'temp' // Use connection ID if provided, otherwise temp
    )

    // Get server time and markets with fresh credentials
    const serverTime = await firiTime()
    const markets = await fetchFiriMarkets(freshCreds, serverTime)

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

    // Update connection with last sync info if connectionId is provided
    if (body.connectionId) {
      await serviceClient
        .from('exchange_connections')
        .update({ 
          updated_at: new Date().toISOString(),
          // You could add a last_sync_at field here if you want to track sync timing
        })
        .eq('id', body.connectionId)
    }

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
