import { createClient } from '@supabase/supabase-js'
import { encryptSecret } from './secrets'
import { secureLogger } from '@/lib/utils/secure-logger'
import { getRequiredEnvVar } from '@/lib/utils/env-validator'

export interface SecretRotationPolicy {
  id: string
  secret_type: 'api_key' | 'api_secret' | 'encryption_key' | 'jwt_secret'
  rotation_interval_days: number
  max_age_days: number
  auto_rotation_enabled: boolean
  require_manual_approval: boolean
  created_at: string
  updated_at: string
}

export interface SecretVersion {
  id: string
  secret_type: 'api_key' | 'api_secret' | 'encryption_key' | 'jwt_secret'
  version_number: number
  secret_hash: string
  encrypted_secret: Buffer
  is_active: boolean
  created_at: string
  expires_at: string | null
  rotated_at: string | null
  rotated_by: string | null
  metadata: Record<string, unknown>
}

export interface RotationHistory {
  id: string
  secret_type: 'api_key' | 'api_secret' | 'encryption_key' | 'jwt_secret'
  old_version_id: string | null
  new_version_id: string
  rotation_method: 'automatic' | 'manual' | 'emergency'
  rotation_reason: string | null
  rotated_by: string | null
  rotated_at: string
  metadata: Record<string, unknown>
}

export interface RotationSchedule {
  id: string
  secret_type: 'api_key' | 'api_secret' | 'encryption_key' | 'jwt_secret'
  next_rotation_date: string
  last_rotation_attempt: string | null
  rotation_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  attempts_count: number
  max_attempts: number
  created_at: string
  updated_at: string
}

export interface RotationResult {
  success: boolean
  new_version_id?: string
  old_version_id?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface RotationCheckResult {
  needs_rotation: boolean
  secret_type: string
  current_age_days: number
  max_age_days: number
  next_rotation_date: string | null
  policy: SecretRotationPolicy | null
}

export class SecretRotationService {
  private supabase: ReturnType<typeof createClient>
  private readonly serviceRoleKey: string

  constructor() {
    this.serviceRoleKey = getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    this.supabase = createClient(
      getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
      this.serviceRoleKey
    )
  }

  /**
   * Check if a secret needs rotation based on its policy
   */
  async checkRotationNeeded(secretType: string): Promise<RotationCheckResult> {
    try {
      const { data: policy, error: policyError } = await this.supabase
        .from('secret_rotation_policies')
        .select('*')
        .eq('secret_type', secretType)
        .single()

      if (policyError || !policy) {
        return {
          needs_rotation: false,
          secret_type: secretType,
          current_age_days: 0,
          max_age_days: 0,
          next_rotation_date: null,
          policy: null
        }
      }

      // Type assertion for the policy data - using unknown first for safety
      const typedPolicy = policy as unknown as SecretRotationPolicy

      const { data: currentSecret, error: secretError } = await this.supabase
        .from('secret_versions')
        .select('*')
        .eq('secret_type', secretType)
        .eq('is_active', true)
        .single()

      if (secretError || !currentSecret) {
        return {
          needs_rotation: true,
          secret_type: secretType,
          current_age_days: 0,
          max_age_days: typedPolicy.max_age_days,
          next_rotation_date: null,
          policy: typedPolicy
        }
      }

      // Type assertion for the currentSecret data
      const typedCurrentSecret = currentSecret as unknown as SecretVersion

      const currentAge = Math.floor(
        (Date.now() - new Date(typedCurrentSecret.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      const needsRotation = currentAge >= typedPolicy.rotation_interval_days

      return {
        needs_rotation: needsRotation,
        secret_type: secretType,
        current_age_days: currentAge,
        max_age_days: typedPolicy.max_age_days,
        next_rotation_date: typedCurrentSecret.expires_at,
        policy: typedPolicy
      }
    } catch (error) {
      secureLogger.error('Failed to check rotation status', {
        secretType,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
      throw new Error(`Failed to check rotation status for ${secretType}`)
    }
  }

  /**
   * Rotate a secret automatically or manually
   */
  async rotateSecret(
    secretType: string,
    newSecret: string,
    method: 'automatic' | 'manual' | 'emergency' = 'automatic',
    reason?: string,
    userId?: string
  ): Promise<RotationResult> {
    try {
      // Check if rotation is allowed
      const { data: policy, error: policyError } = await this.supabase
        .from('secret_rotation_policies')
        .select('*')
        .eq('secret_type', secretType)
        .single()

      if (policyError || !policy) {
        throw new Error(`No rotation policy found for ${secretType}`)
      }

      if (policy.require_manual_approval && method === 'automatic') {
        throw new Error(`Manual approval required for ${secretType} rotation`)
      }

      // Encrypt the new secret
      const encryptedSecret = encryptSecret(newSecret)

      // Use the database function to rotate the secret
      const { data: result, error: rotationError } = await this.supabase
        .rpc('rotate_secret', {
          p_secret_type: secretType,
          p_new_encrypted_secret: encryptedSecret,
          p_rotation_method: method,
          p_rotation_reason: reason
        })

      if (rotationError) {
        throw new Error(`Failed to rotate secret: ${rotationError.message}`)
      }

      // Update rotation history with user info if provided
      if (userId) {
        await this.supabase
          .from('secret_rotation_history')
          .update({ rotated_by: userId })
          .eq('new_version_id', result as string)
      }

      // Log the rotation
      secureLogger.logSecurityEvent('SECRET_ROTATED', {
        secretType,
        method,
        reason,
        userId,
        newVersionId: result
      })

      return {
        success: true,
        new_version_id: result as string,
        metadata: {
          method,
          reason,
          rotated_at: new Date().toISOString()
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      secureLogger.error('Secret rotation failed', {
        secretType,
        method,
        reason,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Rotate encryption key (special handling for master encryption key)
   */
  async rotateEncryptionKey(
    newKey: string,
    method: 'manual' | 'emergency' = 'manual',
    reason?: string,
    userId?: string
  ): Promise<RotationResult> {
    try {
      // Validate the new key format
      if (newKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(newKey)) {
        throw new Error('Invalid encryption key format - must be 64 hex characters')
      }

      // For encryption key rotation, we need to re-encrypt all existing secrets
      const result = await this.rotateSecret('encryption_key', newKey, method, reason, userId)
      
      if (result.success) {
        // Schedule re-encryption of all secrets with new key
        await this.scheduleReEncryption(newKey)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      secureLogger.error('Encryption key rotation failed', {
        method,
        reason,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Schedule re-encryption of all secrets with new encryption key
   */
  private async scheduleReEncryption(newKey: string): Promise<void> {
    try {
      // This would typically be handled by a background job
      // For now, we'll just log the requirement
      secureLogger.logSecurityEvent('RE_ENCRYPTION_SCHEDULED', {
        newKeyHash: Buffer.from(newKey, 'hex').toString('base64').substring(0, 8),
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      secureLogger.error('Failed to schedule re-encryption', {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
    }
  }

  /**
   * Get current active secret
   */
  async getActiveSecret(secretType: string): Promise<Buffer | null> {
    try {
      const { data: result, error } = await this.supabase
        .rpc('get_active_secret', { p_secret_type: secretType })

      if (error || !result) {
        return null
      }

      return Buffer.from(result as string)
    } catch (error) {
      secureLogger.error('Failed to get active secret', {
        secretType,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
      return null
    }
  }

  /**
   * Get rotation history for a secret type
   */
  async getRotationHistory(
    secretType: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<RotationHistory[]> {
    try {
      const { data, error } = await this.supabase
        .from('secret_rotation_history')
        .select('*')
        .eq('secret_type', secretType)
        .order('rotated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new Error(`Failed to get rotation history: ${error.message}`)
      }

      return (data as unknown as RotationHistory[]) || []
    } catch (error) {
      secureLogger.error('Failed to get rotation history', {
        secretType,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
      return []
    }
  }

  /**
   * Get all rotation schedules
   */
  async getRotationSchedules(): Promise<RotationSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from('secret_rotation_schedules')
        .select('*')
        .order('next_rotation_date', { ascending: true })

      if (error) {
        throw new Error(`Failed to get rotation schedules: ${error.message}`)
      }

      return (data as unknown as RotationSchedule[]) || []
    } catch (error) {
      secureLogger.error('Failed to get rotation schedules', {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
      return []
    }
  }

  /**
   * Update rotation policy
   */
  async updateRotationPolicy(
    secretType: string,
    updates: Partial<Omit<SecretRotationPolicy, 'id' | 'secret_type' | 'created_at'>>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('secret_rotation_policies')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('secret_type', secretType)

      if (error) {
        throw new Error(`Failed to update policy: ${error.message}`)
      }

      secureLogger.logSecurityEvent('ROTATION_POLICY_UPDATED', {
        secretType,
        updates,
        timestamp: new Date().toISOString()
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      secureLogger.error('Failed to update rotation policy', {
        secretType,
        updates,
        error: errorMessage
      })
      return false
    }
  }

  /**
   * Emergency rotation - bypasses all checks
   */
  async emergencyRotation(
    secretType: string,
    newSecret: string,
    reason: string,
    userId?: string
  ): Promise<RotationResult> {
    try {
      secureLogger.logSecurityEvent('EMERGENCY_ROTATION_INITIATED', {
        secretType,
        reason,
        userId,
        timestamp: new Date().toISOString()
      })

      const result = await this.rotateSecret(secretType, newSecret, 'emergency', reason, userId)

      if (result.success) {
        secureLogger.logSecurityEvent('EMERGENCY_ROTATION_COMPLETED', {
          secretType,
          reason,
          userId,
          newVersionId: result.new_version_id,
          timestamp: new Date().toISOString()
        })
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      secureLogger.error('Emergency rotation failed', {
        secretType,
        reason,
        userId,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Get rotation statistics
   */
  async getRotationStats(): Promise<Record<string, unknown>> {
    try {
      const { data: policies } = await this.supabase
        .from('secret_rotation_policies')
        .select('*')

      const { data: versions } = await this.supabase
        .from('secret_versions')
        .select('*')

      const { data: history } = await this.supabase
        .from('secret_rotation_history')
        .select('*')

      const stats: Record<string, unknown> = {}

      for (const policy of policies || []) {
        const secretType = policy.secret_type as string
        const typeVersions = versions?.filter(v => v.secret_type === secretType) || []
        const typeHistory = history?.filter(h => h.secret_type === secretType) || []

        stats[secretType] = {
          policy,
          total_versions: typeVersions.length,
          active_versions: typeVersions.filter(v => v.is_active).length,
          total_rotations: typeHistory.length,
          last_rotation: typeHistory.length > 0 ? typeHistory[0].rotated_at : null,
          needs_rotation: await this.checkRotationNeeded(secretType)
        }
      }

      return stats
    } catch (error) {
      secureLogger.error('Failed to get rotation stats', {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
      return {}
    }
  }

  /**
   * Initialize rotation schedules for new secret types
   */
  async initializeRotationSchedules(): Promise<void> {
    try {
      const { data: policies } = await this.supabase
        .from('secret_rotation_policies')
        .select('*')

      for (const policy of policies || []) {
        // Type assertion for the policy data
        const typedPolicy = policy as unknown as SecretRotationPolicy
        
        // Check if schedule exists
        const { data: existingSchedule } = await this.supabase
          .from('secret_rotation_schedules')
          .select('id')
          .eq('secret_type', typedPolicy.secret_type)
          .single()

        if (!existingSchedule) {
          // Create initial schedule
          await this.supabase
            .from('secret_rotation_schedules')
            .insert({
              secret_type: typedPolicy.secret_type,
              next_rotation_date: new Date(Date.now() + typedPolicy.rotation_interval_days * 24 * 60 * 60 * 1000).toISOString(),
              rotation_status: 'pending'
            })
        }
      }
    } catch (error) {
      secureLogger.error('Failed to initialize rotation schedules', {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })
    }
  }
}

// Export singleton instance
export const secretRotationService = new SecretRotationService()
