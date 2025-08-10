#!/usr/bin/env node

/**
 * Debug script for Firi sync credential decryption
 * This script creates a test connection and tests the sync process
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

function encryptSecret(plain) {
  if (!plain || typeof plain !== 'string') {
    throw new Error('Invalid input: plain must be a non-empty string')
  }
  
  try {
    const key = Buffer.from(process.env.SECRETS_ENC_KEY, 'hex')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALG, key, iv)
    
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    
    // Return: IV (12 bytes) + Tag (16 bytes) + Ciphertext
    return Buffer.concat([iv, tag, enc])
  } catch (error) {
    console.error('Failed to encrypt secret:', error.message)
    throw new Error('Failed to encrypt secret')
  }
}

function decryptSecret(blob) {
  if (!Buffer.isBuffer(blob) || blob.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data format')
  }
  
  try {
    const key = Buffer.from(process.env.SECRETS_ENC_KEY, 'hex')
    const iv = blob.subarray(0, IV_LENGTH)
    const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const enc = blob.subarray(IV_LENGTH + TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALG, key, iv)
    decipher.setAuthTag(tag)
    
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch (error) {
    console.error('Failed to decrypt secret:', error.message)
    throw new Error('Failed to decrypt secret')
  }
}

async function debugSyncDecryption() {
  console.log('🔍 Debugging Firi sync credential decryption...\n')
  
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
    // Test encryption/decryption first
    console.log('\n🔐 Testing encryption/decryption...')
    const testSecret = 'test-secret-123'
    const encrypted = encryptSecret(testSecret)
    const decrypted = decryptSecret(encrypted)
    
    if (decrypted === testSecret) {
      console.log('✅ Encryption/decryption test passed')
    } else {
      console.error('❌ Encryption/decryption test failed')
      return false
    }
    
    // Check if there are any existing users
    console.log('\n👥 Checking existing users...')
    const { data: existingUsers, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('❌ Failed to list users:', usersError.message)
      return false
    }
    
    let userId
    if (!existingUsers?.users || existingUsers.users.length === 0) {
      // Create a test user
      console.log('📝 Creating test user...')
      const testUser = {
        email: 'test@arklier.com',
        password: 'testpassword123',
        email_confirm: true
      }
      
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser(testUser)
      
      if (createUserError) {
        console.error('❌ Failed to create test user:', createUserError.message)
        return false
      }
      
      userId = newUser.user.id
      console.log(`✅ Created test user: ${userId}`)
    } else {
      userId = existingUsers.users[0].id
      console.log(`✅ Using existing user: ${userId}`)
    }
    
    // Check if there are any existing connections
    console.log('\n📊 Checking existing connections...')
    const { data: existingConnections, error: connError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('exchange', 'firi')
      .eq('user_id', userId)
      .limit(1)
    
    if (connError) {
      console.error('❌ Failed to fetch connections:', connError.message)
      return false
    }
    
    let connectionId
    if (!existingConnections || existingConnections.length === 0) {
      // Create a test connection
      console.log('📝 Creating test connection...')
      const encryptedSecret = encryptSecret('test-secret-789')
      
      const { error: insertError } = await supabase.rpc('upsert_exchange_connection', {
        p_user_id: userId,
        p_exchange: 'firi',
        p_api_key: 'test-api-key-123',
        p_client_id: 'test-client-id-456',
        p_api_secret: encryptedSecret.toString('hex')
      })
      
      if (insertError) {
        console.error('❌ Failed to create test connection:', insertError.message)
        return false
      }
      
      // Since the RPC doesn't return the inserted data, we need to fetch it separately
      const { data: fetchedConn, error: fetchError } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('exchange', 'firi')
        .single()
      
      if (fetchError) {
        console.error('❌ Failed to fetch created connection:', fetchError.message)
        return false
      }
      
      connectionId = fetchedConn.id
      console.log(`✅ Created test connection: ${connectionId}`)
    } else {
      // Delete the old connection and create a new one to test the fix
      console.log('🗑️ Deleting old connection to test the fix...')
      const { error: deleteError } = await supabase
        .from('exchange_connections')
        .delete()
        .eq('id', existingConnections[0].id)
      
      if (deleteError) {
        console.error('❌ Failed to delete old connection:', deleteError.message)
        return false
      }
      
      console.log('📝 Creating new test connection...')
      const encryptedSecret = encryptSecret('test-secret-789')
      
      const { error: insertError } = await supabase.rpc('upsert_exchange_connection', {
        p_user_id: userId,
        p_exchange: 'firi',
        p_api_key: 'test-api-key-123',
        p_client_id: 'test-client-id-456',
        p_api_secret: encryptedSecret.toString('hex')
      })
      
      if (insertError) {
        console.error('❌ Failed to create test connection:', insertError.message)
        return false
      }
      
      // Since the RPC doesn't return the inserted data, we need to fetch it separately
      const { data: fetchedConn, error: fetchError } = await supabase
        .from('exchange_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('exchange', 'firi')
        .single()
      
      if (fetchError) {
        console.error('❌ Failed to fetch created connection:', fetchError.message)
        return false
      }
      
      connectionId = fetchedConn.id
      console.log(`✅ Created new test connection: ${connectionId}`)
    }
    
    // Now test retrieving the connection and decrypting the secret
    console.log('\n🔍 Testing connection retrieval and decryption...')
    const { data: connData, error: retrieveError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('id', connectionId)
      .single()
    
    if (retrieveError) {
      console.error('❌ Failed to retrieve connection:', retrieveError.message)
      return false
    }
    
    console.log('📋 Retrieved connection data:')
    console.log(`   - API Key: ${connData.api_key?.substring(0, 8)}...`)
    console.log(`   - Client ID: ${connData.client_id?.substring(0, 8)}...`)
    console.log(`   - API Secret type: ${typeof connData.api_secret}`)
    console.log(`   - API Secret constructor: ${connData.api_secret?.constructor?.name}`)
    console.log(`   - API Secret value (first 100 chars): ${String(connData.api_secret).substring(0, 100)}...`)
    console.log(`   - API Secret length: ${connData.api_secret?.length || 0}`)
    
    if (connData.api_secret && typeof connData.api_secret === 'object') {
      console.log(`   - API Secret keys: ${Object.keys(connData.api_secret)}`)
      if ('data' in connData.api_secret) {
        console.log(`   - API Secret data length: ${connData.api_secret.data?.length}`)
      }
    }
    
    // Test decryption
    console.log('\n🔓 Testing decryption...')
    try {
      let apiSecretBuffer
      if (connData.api_secret instanceof Uint8Array) {
        // Convert Uint8Array to Buffer for decryption
        apiSecretBuffer = Buffer.from(connData.api_secret)
        console.log('✅ Converted Uint8Array to Buffer, length:', apiSecretBuffer.length)
        
        // Debug: Let's see what's in this buffer
        console.log('🔍 Debug: First 32 bytes as hex:', apiSecretBuffer.subarray(0, 32).toString('hex'))
        
        // Check if this looks like our expected format (IV + Tag + Ciphertext)
        if (apiSecretBuffer.length < 28) { // IV(12) + Tag(16) = 28 minimum
          console.error('❌ Buffer too short for expected format')
          return false
        }
        
        const iv = apiSecretBuffer.subarray(0, 12)
        const tag = apiSecretBuffer.subarray(12, 28)
        const ciphertext = apiSecretBuffer.subarray(28)
        
        console.log('🔍 Debug: IV (12 bytes):', iv.toString('hex'))
        console.log('🔍 Debug: Tag (16 bytes):', tag.toString('hex'))
        console.log('🔍 Debug: Ciphertext length:', ciphertext.length)
      } else {
        // Fallback for legacy data that might still be in the old format
        throw new Error(`Unexpected api_secret format: ${typeof connData.api_secret}. Expected Uint8Array.`)
      }
      
      const decryptedSecret = decryptSecret(apiSecretBuffer)
      console.log('✅ Successfully decrypted secret:', decryptedSecret.substring(0, 8) + '...')
      
    } catch (decryptError) {
      console.error('❌ Decryption failed:', decryptError.message)
      return false
    }
    
    console.log('\n🎉 All tests passed! The decryption should work in the sync endpoint.')
    return true
    
  } catch (err) {
    console.error('❌ Exception:', err.message)
    return false
  }
}

// Run the debug function
debugSyncDecryption().then(success => {
  process.exit(success ? 0 : 1)
}).catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
