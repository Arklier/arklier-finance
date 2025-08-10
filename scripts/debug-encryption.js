#!/usr/bin/env node

/**
 * Debug script for encryption functions
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const crypto = require('crypto')

console.log('🔍 Debugging encryption functions...\n')

// Check environment variable
const keyEnv = process.env.SECRETS_ENC_KEY
console.log('Environment variable SECRETS_ENC_KEY:')
console.log(`  Raw value: "${keyEnv}"`)
console.log(`  Length: ${keyEnv ? keyEnv.length : 0} characters`)
console.log(`  Type: ${typeof keyEnv}`)

if (keyEnv) {
  // Check for hidden characters
  console.log('\nCharacter analysis:')
  for (let i = 0; i < keyEnv.length; i++) {
    const char = keyEnv[i]
    const code = keyEnv.charCodeAt(i)
    if (code < 32 || code > 126) {
      console.log(`  Position ${i}: '${char}' (code ${code}) - NON-PRINTABLE`)
    }
  }
  
  // Check hex format
  const isHex = /^[0-9a-fA-F]+$/.test(keyEnv)
  console.log(`\nIs valid hex: ${isHex}`)
  
  if (isHex) {
    try {
      const keyBuffer = Buffer.from(keyEnv, 'hex')
      console.log(`Key buffer length: ${keyBuffer.length} bytes`)
      console.log(`Expected length: 32 bytes`)
      console.log(`Valid for AES-256: ${keyBuffer.length === 32}`)
      
      // Test encryption
      console.log('\nTesting encryption...')
      const testSecret = 'test-secret'
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
      
      const enc = Buffer.concat([cipher.update(testSecret, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      const encrypted = Buffer.concat([iv, tag, enc])
      
      console.log('✅ Encryption successful!')
      console.log(`  Test secret: "${testSecret}"`)
      console.log(`  Encrypted length: ${encrypted.length} bytes`)
      
      // Test decryption
      console.log('\nTesting decryption...')
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv)
      decipher.setAuthTag(tag)
      
      const dec = Buffer.concat([decipher.update(enc), decipher.final()])
      const decrypted = dec.toString('utf8')
      
      console.log('✅ Decryption successful!')
      console.log(`  Decrypted: "${decrypted}"`)
      console.log(`  Match: ${decrypted === testSecret}`)
      
    } catch (error) {
      console.error('❌ Error during encryption/decryption test:', error.message)
    }
  }
} else {
  console.error('❌ SECRETS_ENC_KEY is not set')
}
