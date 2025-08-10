#!/usr/bin/env node

/**
 * Test script for Firi sync credential decryption
 * This script tests the decryption functionality directly
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// Encryption/decryption functions (copied from the actual implementation)
const ALG = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16

// fromPgBytea function (copied from the actual implementation)
function fromPgBytea(value) {
  // Handles: \\xHEX, base64, Uint8Array, number[] (rare)
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (Array.isArray(value)) return Buffer.from(value) // edge case
  if (typeof value === 'string') {
    const s = value.trim()
    if (s.startsWith('\\x') || s.startsWith('\\X')) return Buffer.from(s.slice(2), 'hex')
    // try base64 as fallback
    try { return Buffer.from(s, 'base64') } catch {}
  }
  throw new Error('Unsupported bytea representation from database')
}

function decryptSecret(blob) {
  const iv = blob.subarray(0, IV_LENGTH)
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const enc = blob.subarray(IV_LENGTH + TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALG, process.env.SECRETS_ENC_KEY, iv)
  decipher.setAuthTag(tag)
  
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

async function testFiriSyncDecryption() {
  console.log('🧪 Testing Firi sync credential decryption...\n')
  
  // Check environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SECRETS_ENC_KEY'
  ]
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.error(`❌ ${varName} is not set`)
      return false
    }
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 8)}...`)
  }
  
  // Create Supabase client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    // Test direct table access
    console.log('\n📊 Testing direct table access...')
    const { data: connections, error: connError } = await supabase
      .from('exchange_connections')
      .select('id, user_id, api_key, client_id, api_secret')
      .eq('exchange', 'firi')
      .limit(1)
    
    if (connError) {
      console.error('❌ Failed to fetch connections:', connError.message)
      return false
    }
    
    if (!connections || connections.length === 0) {
      console.log('⚠️ No Firi connections found in database')
      return true
    }
    
    const connection = connections[0]
    console.log(`✅ Found connection: ${connection.id}`)
    console.log(`   - API Key: ${connection.api_key.substring(0, 8)}...`)
    console.log(`   - Client ID: ${connection.client_id.substring(0, 8)}...`)
    
    // Check the api_secret format
    if (connection.api_secret) {
      console.log(`   - API Secret type: ${typeof connection.api_secret}`)
      if (Buffer.isBuffer(connection.api_secret)) {
        console.log(`   - API Secret: Buffer with ${connection.api_secret.length} bytes`)
      } else if (connection.api_secret.data) {
        console.log(`   - API Secret: Object with data property, length: ${connection.api_secret.data.length}`)
      } else {
        console.log(`   - API Secret: ${JSON.stringify(connection.api_secret).substring(0, 100)}...`)
      }
    } else {
      console.log('   - API Secret: NULL or undefined')
    }
    
    // Test decryption
    if (connection.api_secret) {
      console.log('\n🔓 Testing decryption...')
      try {
        // Use fromPgBytea to convert the string representation back to Buffer
        const apiSecretBuffer = fromPgBytea(connection.api_secret)
        console.log(`✅ Converted to Buffer: ${apiSecretBuffer.length} bytes`)
        
        const decryptedSecret = decryptSecret(apiSecretBuffer)
        console.log(`✅ Decryption successful! Secret length: ${decryptedSecret.length} characters`)
        console.log(`   - First 8 chars: ${decryptedSecret.substring(0, 8)}...`)
        console.log(`   - Last 8 chars: ...${decryptedSecret.substring(decryptedSecret.length - 8)}`)
        return true
      } catch (decryptError) {
        console.error('❌ Decryption failed:', decryptError.message)
        return false
      }
    } else {
      console.log('⚠️ No API secret to decrypt')
      return true
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
    return false
  }
}

async function runTest() {
  try {
    const success = await testFiriSyncDecryption()
    
    console.log('\n📊 Test Results:')
    if (success) {
      console.log('✅ Firi sync credential decryption test passed!')
      console.log('\nThe sync functionality should now work correctly.')
    } else {
      console.log('❌ Firi sync credential decryption test failed!')
      console.log('\nPlease check the errors above and fix the issues.')
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error)
    process.exit(1)
  }
}

// Run the test
runTest()
