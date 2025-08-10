import crypto from 'crypto'
const ALG = 'aes-256-gcm'

const rawKey = process.env.SECRETS_ENC_KEY || ''
if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error('SECRETS_ENC_KEY must be 64 hex chars (32 bytes)')
}
const key = Buffer.from(rawKey, 'hex')

export interface EncryptionHealth {
  healthy: boolean
  algorithm: string
  keyLength: number
  keyConfigured: boolean
  keyValid: boolean
  encryptionWorking: boolean
}

export function getEncryptionHealth(): EncryptionHealth {
  try {
    // Check if key is configured
    const keyConfigured = !!process.env.SECRETS_ENC_KEY
    
    // Check if key is valid
    const keyValid = /^[0-9a-fA-F]{64}$/.test(process.env.SECRETS_ENC_KEY || '')
    
    // Test encryption/decryption
    let encryptionWorking = false
    if (keyValid) {
      try {
        const testData = 'test-encryption'
        const encrypted = encryptSecret(testData)
        const decrypted = decryptSecret(encrypted)
        encryptionWorking = decrypted === testData
      } catch {
        encryptionWorking = false
      }
    }
    
    // Determine overall health
    const healthy = keyConfigured && keyValid && encryptionWorking
    
    return {
      healthy,
      algorithm: ALG,
      keyLength: key.length,
      keyConfigured,
      keyValid,
      encryptionWorking
    }
  } catch (error) {
    return {
      healthy: false,
      algorithm: ALG,
      keyLength: 0,
      keyConfigured: false,
      keyValid: false,
      encryptionWorking: false
    }
  }
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALG, key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // store iv|tag|enc together
  return Buffer.concat([iv, tag, enc])
}

export function decryptSecret(blob: Buffer) {
  if (blob.length < 12 + 16 + 1) throw new Error('Encrypted blob too short')
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const enc = blob.subarray(28)
  const decipher = crypto.createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Generate a random secret of specified length
 */
export function generateRandomSecret(length: number): string {
  return crypto.randomBytes(length).toString('hex')
}
