import { NextRequest, NextResponse } from 'next/server'
import { secretRotationService } from '@/lib/crypto/secret-rotation'
import { secureLogger } from '@/lib/utils/secure-logger'
import { getRequiredEnvVar } from '@/lib/utils/env-validator'

// Verify service role key for security
function verifyServiceRole(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  
  const token = authHeader.substring(7)
  const expectedToken = getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY')
  
  return token === expectedToken
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyServiceRole(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const secretType = searchParams.get('type')

    switch (action) {
      case 'status':
        if (!secretType) {
          return NextResponse.json({ error: 'Secret type required for status check' }, { status: 400 })
        }
        
        const status = await secretRotationService.checkRotationNeeded(secretType)
        return NextResponse.json(status)

      case 'stats':
        const stats = await secretRotationService.getRotationStats()
        return NextResponse.json(stats)

      case 'schedules':
        const schedules = await secretRotationService.getRotationSchedules()
        return NextResponse.json(schedules)

      case 'history':
        if (!secretType) {
          return NextResponse.json({ error: 'Secret type required for history' }, { status: 400 })
        }
        
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')
        const history = await secretRotationService.getRotationHistory(secretType, limit, offset)
        return NextResponse.json(history)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Secret rotation API error', { error: errorMessage })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyServiceRole(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, secretType, newSecret, method, reason, userId } = body

    if (!action || !secretType) {
      return NextResponse.json({ error: 'Action and secret type required' }, { status: 400 })
    }

    switch (action) {
      case 'rotate':
        if (!newSecret) {
          return NextResponse.json({ error: 'New secret required for rotation' }, { status: 400 })
        }
        
        const result = await secretRotationService.rotateSecret(
          secretType,
          newSecret,
          method || 'automatic',
          reason,
          userId
        )
        
        if (result.success) {
          return NextResponse.json(result)
        } else {
          return NextResponse.json(result, { status: 400 })
        }

      case 'rotate_encryption_key':
        if (!newSecret) {
          return NextResponse.json({ error: 'New encryption key required' }, { status: 400 })
        }
        
        const keyResult = await secretRotationService.rotateEncryptionKey(
          newSecret,
          method || 'manual',
          reason,
          userId
        )
        
        if (keyResult.success) {
          return NextResponse.json(keyResult)
        } else {
          return NextResponse.json(keyResult, { status: 400 })
        }

      case 'emergency':
        if (!newSecret || !reason) {
          return NextResponse.json({ error: 'New secret and reason required for emergency rotation' }, { status: 400 })
        }
        
        const emergencyResult = await secretRotationService.emergencyRotation(
          secretType,
          newSecret,
          reason,
          userId
        )
        
        if (emergencyResult.success) {
          return NextResponse.json(emergencyResult)
        } else {
          return NextResponse.json(emergencyResult, { status: 400 })
        }

      case 'initialize_schedules':
        await secretRotationService.initializeRotationSchedules()
        return NextResponse.json({ success: true, message: 'Rotation schedules initialized' })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Secret rotation API error', { error: errorMessage })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!verifyServiceRole(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { secretType, updates } = body

    if (!secretType || !updates) {
      return NextResponse.json({ error: 'Secret type and updates required' }, { status: 400 })
    }

    const success = await secretRotationService.updateRotationPolicy(secretType, updates)
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Policy updated successfully' })
    } else {
      return NextResponse.json({ error: 'Failed to update policy' }, { status: 400 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    secureLogger.error('Secret rotation policy update error', { error: errorMessage })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
