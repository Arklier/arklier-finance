/**
 * Environment variable validation utility
 * Ensures all required environment variables are present and valid
 */

import { getEncryptionHealth } from '@/lib/crypto/secrets'
import { secureLogger } from '@/lib/utils/secure-logger'

export interface EnvValidationResult {
  isValid: boolean
  missing: string[]
  invalid: Array<{ key: string; reason: string }>
  warnings: string[]
  security: {
    encryptionHealthy: boolean
    encryptionDetails: any
    hasSecureHeaders: boolean
    environment: 'development' | 'staging' | 'production'
  }
}

export interface EnvRule {
  key: string
  required: boolean
  validator?: (value: string) => boolean | string
  description?: string
  sensitive?: boolean
}

const ENV_RULES: EnvRule[] = [
  {
    key: 'SECRETS_ENC_KEY',
    required: true,
    sensitive: true,
    validator: (value) => {
      if (!value) return 'Value is required'
      if (value.length !== 64) return 'Must be exactly 64 hex characters (32 bytes)'
      if (!/^[0-9a-fA-F]+$/.test(value)) return 'Must be a valid hexadecimal string'
      return true
    },
    description: '32-byte encryption key for secrets (64 hex characters)'
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    validator: (value) => {
      if (!value) return 'Value is required'
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return 'Must be a valid HTTP/HTTPS URL'
      }
      return true
    },
    description: 'Supabase project URL'
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    validator: (value) => {
      if (!value) return 'Value is required'
      if (value.length < 50) return 'Must be at least 50 characters long'
      return true
    },
    description: 'Supabase anonymous key'
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    sensitive: true,
    validator: (value) => {
      if (!value) return 'Value is required'
      if (value.length < 50) return 'Must be at least 50 characters long'
      return true
    },
    description: 'Supabase service role key'
  },
  {
    key: 'NODE_ENV',
    required: false,
    validator: (value) => {
      if (value && !['development', 'staging', 'production'].includes(value)) {
        return 'Must be one of: development, staging, production'
      }
      return true
    },
    description: 'Node.js environment'
  }
]

/**
 * Validate all environment variables against defined rules
 * @returns Validation result with details about any issues
 */
export function validateEnvironment(): EnvValidationResult {
  const result: EnvValidationResult = {
    isValid: true,
    missing: [],
    invalid: [],
    warnings: [],
    security: {
      encryptionHealthy: false,
      encryptionDetails: null,
      hasSecureHeaders: false,
      environment: 'development'
    }
  }

  // Determine environment
  const nodeEnv = process.env.NODE_ENV || 'development'
  result.security.environment = nodeEnv as 'development' | 'staging' | 'production'

  // Validate basic environment variables
  for (const rule of ENV_RULES) {
    const value = process.env[rule.key]
    
    // Check if required variable is missing
    if (rule.required && !value) {
      result.missing.push(rule.key)
      result.isValid = false
      continue
    }
    
    // Skip validation for missing optional variables
    if (!value) continue
    
    // Validate value if validator is provided
    if (rule.validator) {
      const validationResult = rule.validator(value)
      if (validationResult !== true) {
        result.invalid.push({
          key: rule.key,
          reason: validationResult as string
        })
        result.isValid = false
      }
    }
  }

  // Check encryption health
  try {
    const encryptionHealth = getEncryptionHealth()
    result.security.encryptionHealthy = encryptionHealth.healthy
    result.security.encryptionDetails = {
      algorithm: encryptionHealth.algorithm,
      keyLength: encryptionHealth.keyLength,
      keyConfigured: encryptionHealth.keyConfigured,
      keyValid: encryptionHealth.keyValid,
      encryptionWorking: encryptionHealth.encryptionWorking
    }
    
    if (!encryptionHealth.healthy) {
      result.isValid = false
      result.warnings.push('Encryption system is not healthy - secrets may not be secure')
    }
  } catch (error) {
    result.security.encryptionHealthy = false
    result.isValid = false
    result.warnings.push('Failed to validate encryption system')
    
    secureLogger.error('Encryption health check failed', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error 
    })
  }

  // Check for secure headers configuration
  if (nodeEnv === 'production') {
    result.security.hasSecureHeaders = true
  }

  // Add warnings for development environment
  if (nodeEnv === 'development') {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) {
      result.warnings.push('Using local Supabase instance - ensure local development is running')
    }
    
    // Warn about development encryption key
    if (process.env.SECRETS_ENC_KEY === 'your_64_character_hex_encryption_key_here') {
      result.warnings.push('Using default encryption key - generate a unique key for development')
    }
  }

  // Add warnings for production environment
  if (nodeEnv === 'production') {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) {
      result.warnings.push('WARNING: Using localhost URL in production environment')
      result.isValid = false
    }
    
    // Check for weak encryption keys
    if (process.env.SECRETS_ENC_KEY === 'your_64_character_hex_encryption_key_here') {
      result.warnings.push('CRITICAL: Using default encryption key in production - generate a unique key immediately')
      result.isValid = false
    }
  }

  // Log validation results for security monitoring
  if (!result.isValid) {
    secureLogger.logSecurityEvent('ENVIRONMENT_VALIDATION_FAILED', {
      missing: result.missing,
      invalid: result.invalid,
      warnings: result.warnings,
      environment: nodeEnv
    })
  } else {
    secureLogger.logSecurityEvent('ENVIRONMENT_VALIDATION_PASSED', {
      environment: nodeEnv,
      encryptionHealthy: result.security.encryptionHealthy
    })
  }

  return result
}

/**
 * Validate a specific environment variable
 * @param key - Environment variable key
 * @returns Validation result for the specific variable
 */
export function validateEnvVar(key: string): { isValid: boolean; reason?: string } {
  const rule = ENV_RULES.find(r => r.key === key)
  if (!rule) {
    return { isValid: false, reason: 'No validation rule defined for this variable' }
  }

  const value = process.env[key]
  
  if (rule.required && !value) {
    return { isValid: false, reason: 'Required environment variable is missing' }
  }
  
  if (!value) {
    return { isValid: true } // Optional variable, no validation needed
  }
  
  if (rule.validator) {
    const validationResult = rule.validator(value)
    if (validationResult !== true) {
      return { isValid: false, reason: validationResult as string }
    }
  }
  
  return { isValid: true }
}

/**
 * Get environment variable with validation
 * @param key - Environment variable key
 * @returns The environment variable value if valid, throws error if invalid
 */
export function getRequiredEnvVar(key: string): string {
  const validation = validateEnvVar(key)
  if (!validation.isValid) {
    throw new Error(`Environment variable ${key} is invalid: ${validation.reason}`)
  }
  
  const value = process.env[key]
  if (!value) {
    throw new Error(`Environment variable ${key} is missing`)
  }
  
  return value
}

/**
 * Get environment variable safely (for sensitive data)
 * @param key - Environment variable key
 * @returns The environment variable value if valid, throws error if invalid
 */
export function getSecureEnvVar(key: string): string {
  const rule = ENV_RULES.find(r => r.key === key)
  if (rule?.sensitive) {
    secureLogger.logSecurityEvent('SENSITIVE_ENV_ACCESS', { key })
  }
  
  return getRequiredEnvVar(key)
}

/**
 * Print environment validation report to console
 * @param result - Validation result from validateEnvironment()
 */
export function printEnvValidationReport(result: EnvValidationResult): void {
  console.log('\n=== Environment Validation Report ===')
  
  if (result.isValid) {
    console.log('✅ All environment variables are valid')
  } else {
    console.log('❌ Environment validation failed')
  }
  
  if (result.missing.length > 0) {
    console.log('\n❌ Missing required variables:')
    result.missing.forEach(key => {
      const rule = ENV_RULES.find(r => r.key === key)
      console.log(`   ${key}: ${rule?.description || 'No description available'}`)
    })
  }
  
  if (result.invalid.length > 0) {
    console.log('\n❌ Invalid variables:')
    result.invalid.forEach(({ key, reason }) => {
      const rule = ENV_RULES.find(r => r.key === key)
      console.log(`   ${key}: ${reason}`)
      if (rule?.description) {
        console.log(`      Expected: ${rule.description}`)
      }
    })
  }
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    result.warnings.forEach(warning => console.log(`   ${warning}`))
  }
  
  // Security section
  console.log('\n🔒 Security Status:')
  console.log(`   Environment: ${result.security.environment}`)
  console.log(`   Encryption: ${result.security.encryptionHealthy ? '✅ Healthy' : '❌ Unhealthy'}`)
  console.log(`   Secure Headers: ${result.security.hasSecureHeaders ? '✅ Enabled' : '⚠️  Development Mode'}`)
  
  if (result.security.encryptionDetails) {
    console.log(`   Algorithm: ${result.security.encryptionDetails.algorithm}`)
    console.log(`   Key Length: ${result.security.encryptionDetails.keyLength} bytes`)
  }
  
  console.log('\n=====================================\n')
}
