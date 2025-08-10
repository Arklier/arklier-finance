import { NextRequest, NextResponse } from 'next/server'
import { encryptSecret } from '@/lib/crypto/secrets'
import { createClient } from '@/lib/supabase/server'
import { secureLogger } from '@/lib/utils/secure-logger'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let userId: string | undefined
  
  try {
    const { apiKey, clientId, secret } = await req.json()
    
    // Validate required fields
    if (!apiKey || !clientId || !secret) {
      secureLogger.audit({
        action: 'FIRI_CONNECT_VALIDATION_FAILED',
        resource: '/api/exchanges/firi/connect',
        success: false,
        error: 'Missing required fields',
        metadata: { hasApiKey: !!apiKey, hasClientId: !!clientId, hasSecret: !!secret }
      })
      
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, clientId, and secret are required' },
        { status: 400 }
      )
    }

    // Validate input lengths and formats
    if (typeof apiKey !== 'string' || typeof clientId !== 'string' || typeof secret !== 'string') {
      secureLogger.audit({
        action: 'FIRI_CONNECT_INVALID_TYPE',
        resource: '/api/exchanges/firi/connect',
        success: false,
        error: 'Invalid field types',
        metadata: { 
          apiKeyType: typeof apiKey, 
          clientIdType: typeof clientId, 
          secretType: typeof secret 
        }
      })
      
      return NextResponse.json(
        { error: 'All fields must be strings' },
        { status: 400 }
      )
    }

    // Validate reasonable length limits
    if (apiKey.length > 100 || clientId.length > 100 || secret.length > 500) {
      secureLogger.audit({
        action: 'FIRI_CONNECT_INVALID_LENGTH',
        resource: '/api/exchanges/firi/connect',
        success: false,
        error: 'Field lengths exceed reasonable limits',
        metadata: { 
          apiKeyLength: apiKey.length, 
          clientIdLength: clientId.length, 
          secretLength: secret.length 
        }
      })
      
      return NextResponse.json(
        { error: 'Field lengths exceed reasonable limits' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get current user
    console.log('🔍 API: Getting user from Supabase...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('📋 API: Auth result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      error: authError?.message 
    })
    
    if (authError || !user) {
      console.error('❌ API: Authentication failed:', authError?.message)
      secureLogger.audit({
        action: 'FIRI_CONNECT_AUTH_FAILED',
        resource: '/api/exchanges/firi/connect',
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
    console.log('✅ API: User authenticated:', userId)

    // Encrypt the secret before storage
    const encryptedSecret = encryptSecret(secret)
    
    // Store connection in database
    const { error: dbError } = await supabase
      .from('exchange_connections')
      .upsert({
        user_id: user.id,
        exchange: 'firi',
        api_key: apiKey,
        client_id: clientId,
        api_secret: encryptedSecret,
      })

    if (dbError) {
      secureLogger.logDatabaseOperation('INSERT', 'exchange_connections', userId, false, dbError.message)
      
      return NextResponse.json(
        { error: 'Failed to save connection' },
        { status: 500 }
      )
    }

    // Log successful connection
    secureLogger.audit({
      action: 'FIRI_CONNECT_SUCCESS',
      resource: '/api/exchanges/firi/connect',
      userId,
      success: true,
      metadata: { 
        exchange: 'firi',
        apiKeyLength: apiKey.length,
        clientIdLength: clientId.length,
        secretLength: secret.length,
        processingTime: Date.now() - startTime
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    // Log error without exposing secrets
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Firi connect failed', error)
    
    secureLogger.audit({
      action: 'FIRI_CONNECT_ERROR',
      resource: '/api/exchanges/firi/connect',
      userId,
      success: false,
      error: errorMessage,
      metadata: { processingTime: Date.now() - startTime }
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
