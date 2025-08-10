import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateEnvironment } from '@/lib/utils/env-validator'
import { getEncryptionHealth } from '@/lib/crypto/secrets'
import { secureLogger } from '@/lib/utils/secure-logger'

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    
    // Get current user for audit logging
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      secureLogger.audit({
        action: 'SECURITY_HEALTH_CHECK_AUTH_FAILED',
        resource: '/api/security/health',
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

    // Validate environment
    const envValidation = validateEnvironment()
    
    // Get encryption health
    const encryptionHealth = getEncryptionHealth()
    
    // Check database connection security
    let dbSecurityStatus = 'unknown'
    try {
      const { error: dbError } = await supabase
        .from('exchange_connections')
        .select('id')
        .limit(1)
      
      if (dbError) {
        dbSecurityStatus = 'error'
        secureLogger.error('Database security check failed', { 
          errorType: dbError.constructor.name,
          hasMessage: !!dbError.message 
        })
      } else {
        dbSecurityStatus = 'healthy'
      }
    } catch (error) {
      dbSecurityStatus = 'error'
      secureLogger.error('Database security check exception', { 
        errorType: error instanceof Error ? error.constructor.name : typeof error 
      })
    }

    // Prepare security health response
    const securityHealth = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      overall: envValidation.isValid && encryptionHealth.healthy && dbSecurityStatus === 'healthy',
      components: {
        environment: {
          status: envValidation.isValid ? 'healthy' : 'unhealthy',
          issues: envValidation.missing.length + envValidation.invalid.length,
          warnings: envValidation.warnings.length
        },
        encryption: {
          status: encryptionHealth.healthy ? 'healthy' : 'unhealthy',
          algorithm: encryptionHealth.algorithm,
          keyLength: encryptionHealth.keyLength,
          keyConfigured: encryptionHealth.keyConfigured,
          keyValid: encryptionHealth.keyValid
        },
        database: {
          status: dbSecurityStatus,
          connection: dbSecurityStatus === 'healthy' ? 'secure' : 'insecure'
        },
        headers: {
          status: process.env.NODE_ENV === 'production' ? 'enabled' : 'development',
          csp: process.env.NODE_ENV === 'production',
          hsts: process.env.NODE_ENV === 'production'
        }
      },
      recommendations: []
    }

    // Add recommendations based on health status
    if (!envValidation.isValid) {
      securityHealth.recommendations.push('Fix environment variable issues')
    }
    
    if (!encryptionHealth.healthy) {
      securityHealth.recommendations.push('Fix encryption system issues')
    }
    
    if (dbSecurityStatus !== 'healthy') {
      securityHealth.recommendations.push('Check database connection security')
    }
    
    if (process.env.NODE_ENV === 'development') {
      securityHealth.recommendations.push('Review security settings before production deployment')
    }

    // Log successful health check
    secureLogger.audit({
      action: 'SECURITY_HEALTH_CHECK_SUCCESS',
      resource: '/api/security/health',
      userId,
      success: true,
      metadata: { 
        overall: securityHealth.overall,
        processingTime: Date.now() - startTime,
        environment: securityHealth.environment
      }
    })

    return NextResponse.json(securityHealth)

  } catch (error) {
    // Log error without exposing sensitive information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Security health check failed', error)
    
    secureLogger.audit({
      action: 'SECURITY_HEALTH_CHECK_ERROR',
      resource: '/api/security/health',
      userId,
      success: false,
      error: errorMessage,
      metadata: { processingTime: Date.now() - startTime }
    })

    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        overall: false
      },
      { status: 500 }
    )
  }
}
