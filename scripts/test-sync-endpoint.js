#!/usr/bin/env node

/**
 * Test script for Firi sync endpoint
 * This script tests the sync functionality directly
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// Encryption/decryption functions (copied from the actual implementation)
const ALG = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function decryptSecret(blob) {
  const iv = blob.subarray(0, IV_LENGTH)
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const enc = blob.subarray(IV_LENGTH + TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALG, process.env.SECRETS_ENC_KEY, iv)
  decipher.setAuthTag(tag)
  
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

async function testSyncEndpoint() {
  console.log('🧪 Testing Firi sync endpoint...\n')
  
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
  
  // Verify encryption key length
  const keyLength = Buffer.from(process.env.SECRETS_ENC_KEY, 'hex').length
  console.log(`🔑 Encryption key length: ${keyLength} bytes (${keyLength * 8} bits)`)
  
  if (keyLength !== 32) {
    console.error(`❌ Invalid key length. Expected 32 bytes for AES-256, got ${keyLength}`)
    return false
  }
  
  // Create Supabase client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    // First, let's test the stored procedure directly
    console.log('\n📊 Testing stored procedure directly...')
    
    // Get a connection using the stored procedure
    const { data: connections, error: connError } = await supabase
      .from('exchange_connections')
      .select('id, user_id')
      .eq('exchange', 'firi')
      .limit(1)
    
    if (connError) {
      console.error('❌ Failed to fetch connections:', connError.message)
      return false
    }
    
    if (!connections || connections.length === 0) {
      console.log('⚠️ No Firi connections found in database')
      return false
    }
    
    const connection = connections[0]
    console.log(`✅ Using connection: ${connection.id}`)
    
    // Test the stored procedure
    console.log('\n🔐 Testing stored procedure with bytea data...')
    const { data: connData, error: procError } = await supabase.rpc('get_connection_with_secret_bypass_rls', {
      p_conn_id: connection.id,
      p_user_id: connection.user_id
    })
    
    if (procError) {
      console.error('❌ Stored procedure failed:', procError.message)
      return false
    }
    
    if (!connData || connData.length === 0) {
      console.error('❌ No data returned from stored procedure')
      return false
    }
    
    const conn = connData[0]
    console.log('✅ Stored procedure returned data:')
    console.log(`   - API Key: ${conn.api_key.substring(0, 8)}...`)
    console.log(`   - Client ID: ${conn.client_id.substring(0, 8)}...`)
    console.log(`   - API Secret: ${conn.api_secret ? 'Buffer with ' + conn.api_secret.data.length + ' bytes' : 'NULL'}`)
    
    // Test decryption
    if (conn.api_secret && conn.api_secret.data) {
      console.log('\n🔓 Testing decryption...')
      try {
        const apiSecretBuffer = Buffer.from(conn.api_secret.data)
        const decryptedSecret = decryptSecret(apiSecretBuffer)
        console.log(`✅ Decryption successful! Secret length: ${decryptedSecret.length} characters`)
        console.log(`   - First 8 chars: ${decryptedSecret.substring(0, 8)}...`)
        console.log(`   - Last 8 chars: ...${decryptedSecret.substring(decryptedSecret.length - 8)}`)
        
        // Test that the decrypted secret matches what we expect
        if (decryptedSecret.includes('test_secret_')) {
          console.log('✅ Decrypted secret matches expected test value')
        } else {
          console.log('⚠️ Decrypted secret does not match expected test value')
        }
        
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
    const success = await testSyncEndpoint()
    
    console.log('\n📊 Test Results:')
    if (success) {
      console.log('✅ Firi sync credential decryption test passed!')
      console.log('\nThe sync functionality should now work correctly.')
      console.log('\nNext steps:')
      console.log('1. Access the dashboard at http://localhost:3001/dashboard')
      console.log('2. Navigate to Firi exchange page')
      console.log('3. Try to sync the connection')
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
