import crypto from 'crypto'
import { secureLogger } from '@/lib/utils/secure-logger'

const ALG = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits for GCM
const TAG_LENGTH = 16 // 128 bits for GCM

// Validate encryption key on module load
function validateEncryptionKey(): Buffer {
  const keyEnv = process.env.SECRETS_ENC_KEY
  if (!keyEnv) {
    throw new Error('SECRETS_ENC_KEY environment variable is required for secret encryption')
  }
  
  if (keyEnv.length !== KEY_LENGTH * 2) { // hex string is 2x bytes
    throw new Error(`SECRETS_ENC_KEY must be exactly ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`)
  }
  
  if (!/^[0-9a-fA-F]+$/.test(keyEnv)) {
    throw new Error('SECRETS_ENC_KEY must be a valid hexadecimal string')
  }
  
  return Buffer.from(keyEnv, 'hex')
}

// Initialize encryption key
const encryptionKey = validateEncryptionKey()

/**
 * Encrypt a secret string using AES-256-GCM
 * @param plain - Plain text secret to encrypt
 * @returns Encrypted data as Buffer (IV + Tag + Ciphertext)
 */
export function encryptSecret(plain: string): Buffer {
  if (!plain || typeof plain !== 'string') {
    throw new Error('Invalid input: plain must be a non-empty string')
  }
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALG, encryptionKey, iv)
    
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    
    // Return: IV (12 bytes) + Tag (16 bytes) + Ciphertext
    return Buffer.concat([iv, tag, enc])
  } catch (error) {
    // Log the error type but never the actual secret content
    secureLogger.error('Failed to encrypt secret', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      hasSecret: !!plain,
      secretLength: plain.length
    })
    throw new Error('Failed to encrypt secret')
  }
}

/**
 * Decrypt a secret from encrypted Buffer
 * @param blob - Encrypted data (IV + Tag + Ciphertext)
 * @returns Decrypted secret string
 */
export function decryptSecret(blob: Buffer): string {
  if (!Buffer.isBuffer(blob) || blob.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data format')
  }
  
  try {
    const iv = blob.subarray(0, IV_LENGTH)
    const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const enc = blob.subarray(IV_LENGTH + TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALG, encryptionKey, iv)
    decipher.setAuthTag(tag)
    
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch (error) {
    // Log the error type but never the actual encrypted content
    secureLogger.error('Failed to decrypt secret', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      hasBlob: !!blob,
      blobLength: blob.length,
      blobType: blob.constructor.name
    })
    throw new Error('Failed to decrypt secret')
  }
}

/**
 * Generate a new encryption key (for rotation)
 * @returns Hex string of new 32-byte key
 */
export function generateNewEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Validate if a string looks like a valid encryption key
 * @param key - Hex string to validate
 * @returns true if valid format
 */
export function isValidEncryptionKey(key: string): boolean {
  return Boolean(key && typeof key === 'string' && 
         key.length === KEY_LENGTH * 2 && 
         /^[0-9a-fA-F]+$/.test(key))
}

/**
 * Get encryption algorithm info (for debugging, no secrets)
 * @returns Object with algorithm details
 */
export function getEncryptionInfo() {
  return {
    algorithm: ALG,
    keyLength: KEY_LENGTH,
    ivLength: IV_LENGTH,
    tagLength: TAG_LENGTH,
    totalOverhead: IV_LENGTH + TAG_LENGTH
  }
}

/**
 * Test encryption/decryption functionality
 * @returns true if encryption is working properly
 */
export function testEncryption(): boolean {
  try {
    const testSecret = 'test-secret-' + Date.now()
    const encrypted = encryptSecret(testSecret)
    const decrypted = decryptSecret(encrypted)
    return decrypted === testSecret
  } catch (error) {
    secureLogger.error('Encryption test failed', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error 
    })
    return false
  }
}

/**
 * Generate a random secret string of specified length
 * @param length - Length of the secret in bytes
 * @returns Random hex string
 */
export function generateRandomSecret(length: number): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Get encryption health status
 * @returns Object with encryption system health information
 */
export function getEncryptionHealth() {
  const keyValid = isValidEncryptionKey(process.env.SECRETS_ENC_KEY || '')
  const testPassed = testEncryption()
  
  return {
    keyConfigured: !!process.env.SECRETS_ENC_KEY,
    keyValid,
    encryptionWorking: testPassed,
    algorithm: ALG,
    keyLength: KEY_LENGTH,
    healthy: keyValid && testPassed
  }
}

/**
 * Re-encrypt a secret with a new key (for key rotation)
 * @param oldEncryptedSecret - Currently encrypted secret
 * @param newKey - New encryption key (hex string)
 * @returns Re-encrypted secret with new key
 */
export function reEncryptSecret(oldEncryptedSecret: Buffer, newKey: string): Buffer {
  if (!isValidEncryptionKey(newKey)) {
    throw new Error('Invalid new encryption key format')
  }
  
  try {
    // Decrypt with old key
    const plainSecret = decryptSecret(oldEncryptedSecret)
    
    // Encrypt with new key
    const newKeyBuffer = Buffer.from(newKey, 'hex')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALG, newKeyBuffer, iv)
    
    const enc = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    
    return Buffer.concat([iv, tag, enc])
  } catch (error) {
    secureLogger.error('Failed to re-encrypt secret', { 
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      hasOldSecret: !!oldEncryptedSecret,
      hasNewKey: !!newKey
    })
    throw new Error('Failed to re-encrypt secret')
  }
}
