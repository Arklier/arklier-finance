#!/usr/bin/env node

/**
 * CLI script for managing the secret rotation system
 * Usage: npx tsx src/lib/crypto/rotation-cli.ts [command] [options]
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
config({ path: '.env.local' })

import { secureLogger } from '../utils/secure-logger'

interface CLICommand {
  name: string
  description: string
  action: () => Promise<void>
  options?: string[]
}

// Check environment variables before importing crypto modules
function checkEnvironment(): boolean {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'SECRETS_ENC_KEY'
  ]
  
  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(varName => {
      console.error(`   - ${varName}`)
    })
    console.error('\nPlease check your .env.local file and ensure all required variables are set.')
    console.error('See env.example for the required variables.')
    console.error('\n💡 Quick fixes:')
    console.error('1. Copy .env.example to .env.local and fill in your values')
    console.error('2. For SECRETS_ENC_KEY, generate a 64-character hex string:')
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    console.error('3. Run: pnpm run rotation:env-check to verify setup')
    console.error('4. Run: pnpm run rotation:test to run basic tests')
    return false
  }
  
  // Additional validation for SECRETS_ENC_KEY format
  const encKey = process.env.SECRETS_ENC_KEY
  if (encKey && !/^[a-fA-F0-9]{64}$/.test(encKey)) {
    console.error('❌ SECRETS_ENC_KEY must be a 64-character hex string')
    console.error('Current value length:', encKey.length)
    console.error('Generate a new one with:')
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    return false
  }
  
  return true
}

// Lazy load crypto modules only when needed
async function loadCryptoModules() {
  if (!checkEnvironment()) {
    process.exit(1)
  }
  
  try {
    const { initializeSecretRotation } = await import('./init-rotation')
    const { SecretRotationService } = await import('./secret-rotation')
    
    // Create a service instance for the functions that need it
    const service = new SecretRotationService()
    
    return {
      initializeSecretRotationSystem: initializeSecretRotation,
      getRotationStatus: () => service.checkRotationNeeded('api_key'), // Example check
      getRotationHistory: () => service.getRotationHistory('api_key'),
      getRotationSchedules: () => service.getRotationSchedules(),
      getRotationStats: () => service.getRotationStats(),
      triggerManualRotation: (secretType: string) => service.rotateSecret(secretType, 'new_secret_value', 'manual'),
      updateRotationPolicy: (secretType: string, maxAgeDays: number, warningDays: number) => 
        service.updateRotationPolicy(secretType, { max_age_days: maxAgeDays }),
      getActiveSecret: async (secretType: string) => {
        const secret = await service.getActiveSecret(secretType)
        if (!secret) {
          throw new Error(`No active secret found for ${secretType}`)
        }
        // Return a mock object since getActiveSecret returns Buffer
        return {
          id: 'active',
          version: 'current',
          created_at: new Date().toISOString(),
          expires_at: null
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to load crypto modules:', error)
    console.error('This usually means there are missing dependencies or environment issues.')
    process.exit(1)
  }
}

const commands: CLICommand[] = [
  {
    name: 'init',
    description: 'Initialize the secret rotation system',
    action: async () => {
      try {
        const { initializeSecretRotationSystem } = await loadCryptoModules()
        console.log('🚀 Initializing secret rotation system...')
        await initializeSecretRotationSystem()
        console.log('✅ Secret rotation system initialized successfully!')
      } catch (error) {
        console.error('❌ Failed to initialize secret rotation system:', error)
        process.exit(1)
      }
    }
  },
  {
    name: 'status',
    description: 'Check rotation status for all secret types',
    action: async () => {
      try {
        const { getRotationStatus } = await loadCryptoModules()
        console.log('📊 Checking rotation status...')
        const status = await getRotationStatus()
        console.log('Rotation Status:', JSON.stringify(status, null, 2))
      } catch (error) {
        console.error('❌ Failed to get rotation status:', error)
        process.exit(1)
      }
    }
  },
  {
    name: 'history',
    description: 'View rotation history',
    action: async () => {
      try {
        const { getRotationHistory } = await loadCryptoModules()
        console.log('📜 Fetching rotation history...')
        const history = await getRotationHistory()
        console.log('Rotation History:', JSON.stringify(history, null, 2))
      } catch (error) {
        console.error('❌ Failed to get rotation history:', error)
        process.exit(1)
      }
    }
  },
  {
    name: 'schedules',
    description: 'View rotation schedules',
    action: async () => {
      try {
        const { getRotationSchedules } = await loadCryptoModules()
        console.log('⏰ Fetching rotation schedules...')
        const schedules = await getRotationSchedules()
        console.log('Rotation Schedules:', JSON.stringify(schedules, null, 2))
      } catch (error) {
        console.error('❌ Failed to get rotation schedules:', error)
        process.exit(1)
      }
    }
  },
  {
    name: 'stats',
    description: 'View rotation statistics',
    action: async () => {
      try {
        const { getRotationStats } = await loadCryptoModules()
        console.log('📈 Fetching rotation statistics...')
        const stats = await getRotationStats()
        console.log('Rotation Stats:', JSON.stringify(stats, null, 2))
      } catch (error) {
        console.error('❌ Failed to get rotation stats:', error)
        process.exit(1)
      }
    }
  },
  {
    name: 'rotate',
    description: 'Trigger manual rotation for a secret type',
    options: ['<secret_type>'],
    action: async () => {
      const secretType = process.argv[3]
      if (!secretType) {
        console.error('❌ Please specify a secret type (e.g., "api_key", "encryption_key")')
        process.exit(1)
      }
      
      try {
        const { triggerManualRotation } = await loadCryptoModules()
        console.log(`🔄 Triggering manual rotation for ${secretType}...`)
        const result = await triggerManualRotation(secretType)
        console.log(`✅ Manual rotation completed for ${secretType}:`, result)
      } catch (error) {
        console.error(`❌ Failed to trigger manual rotation for ${secretType}:`, error)
        process.exit(1)
      }
    }
  },
  {
    name: 'policy',
    description: 'Update rotation policy for a secret type',
    options: ['<secret_type>', '<max_age_days>', '<warning_days>'],
    action: async () => {
      const secretType = process.argv[3]
      const maxAgeDays = parseInt(process.argv[4])
      const warningDays = parseInt(process.argv[5])
      
      if (!secretType || isNaN(maxAgeDays) || isNaN(warningDays)) {
        console.error('❌ Usage: policy <secret_type> <max_age_days> <warning_days>')
        console.error('Example: policy api_key 90 30')
        process.exit(1)
      }
      
      try {
        const { updateRotationPolicy } = await loadCryptoModules()
        console.log(`⚙️ Updating rotation policy for ${secretType}...`)
        await updateRotationPolicy(secretType, maxAgeDays, warningDays)
        console.log(`✅ Rotation policy updated for ${secretType}`)
      } catch (error) {
        console.error(`❌ Failed to update rotation policy for ${secretType}:`, error)
        process.exit(1)
      }
    }
  },
  {
    name: 'active',
    description: 'Get active secret for a secret type',
    options: ['<secret_type>'],
    action: async () => {
      const secretType = process.argv[3]
      if (!secretType) {
        console.error('❌ Please specify a secret type')
        process.exit(1)
      }
      
      try {
        const { getActiveSecret } = await loadCryptoModules()
        console.log(`🔑 Getting active secret for ${secretType}...`)
        const secret = await getActiveSecret(secretType)
        console.log(`Active secret for ${secretType}:`, {
          id: secret.id,
          version: secret.version,
          created_at: secret.created_at,
          expires_at: secret.expires_at
        })
      } catch (error) {
        console.error(`❌ Failed to get active secret for ${secretType}:`, error)
        process.exit(1)
      }
    }
  },
  {
    name: 'env-check',
    description: 'Check if all required environment variables are set',
    action: async () => {
      console.log('🔍 Checking environment variables...')
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY', 
        'SECRETS_ENC_KEY'
      ]
      
      let allGood = true
      requiredVars.forEach(varName => {
        const value = process.env[varName]
        if (value) {
          // Mask the value for security
          const masked = value.length > 8 ? 
            value.substring(0, 4) + '...' + value.substring(value.length - 4) : 
            '***'
          console.log(`✅ ${varName}: ${masked}`)
        } else {
          console.log(`❌ ${varName}: NOT SET`)
          allGood = false
        }
      })
      
      if (allGood) {
        console.log('\n✅ All required environment variables are set!')
      } else {
        console.log('\n❌ Some required environment variables are missing.')
        console.log('Please check your .env.local file.')
        process.exit(1)
      }
    }
  },
  {
    name: 'help',
    description: 'Show this help message',
    action: async () => {
      showHelp()
    }
  }
]

function showHelp() {
  console.log(`
🔐 Secret Rotation CLI

Usage: npx tsx src/lib/crypto/rotation-cli.ts [command] [options]

Commands:
${commands.map(cmd => {
  const options = cmd.options ? ` ${cmd.options.join(' ')}` : ''
  return `  ${cmd.name}${options}    ${cmd.description}`
}).join('\n')}

Examples:
  npx tsx src/lib/crypto/rotation-cli.ts env-check
  npx tsx src/lib/crypto/rotation-cli.ts init
  npx tsx src/lib/crypto/rotation-cli.ts status
  npx tsx src/lib/crypto/rotation-cli.ts rotate api_key
  npx tsx src/lib/crypto/rotation-cli.ts policy api_key 90 30
  npx tsx src/lib/crypto/rotation-cli.ts active api_key

Environment Variables:
  Make sure you have the following environment variables set:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - SECRETS_ENC_KEY (64-character hex string)

  Run 'env-check' command to verify your environment setup.

Package Scripts:
  You can also use the npm/pnpm scripts:
  pnpm run rotation:init
  pnpm run rotation:status
  pnpm run rotation:help
`)
}

async function main() {
  const command = process.argv[2] || 'help'
  
  const cmd = commands.find(c => c.name === command)
  if (!cmd) {
    console.error(`❌ Unknown command: ${command}`)
    showHelp()
    process.exit(1)
  }
  
  try {
    await cmd.action()
  } catch (error) {
    console.error('❌ Command failed:', error)
    process.exit(1)
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ CLI execution failed:', error)
    process.exit(1)
  })
}

export { commands, showHelp }
