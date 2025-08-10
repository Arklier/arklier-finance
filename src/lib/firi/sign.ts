import crypto from 'crypto'

export type FiriCreds = {
  apiKey: string
  clientId: string
  secretPlain: string
}

export type FiriHeaders = {
  'API-key': string
  clientID: string
  timestamp: string
  validity: string
  'HMAC_encrypted_secretKey': string
}

/**
 * Firi API authentication headers
 * Based on Firi API documentation, the HMAC signature is calculated as:
 * HMAC-SHA256(secret, `${timestamp}${validity}`)
 * 
 * The server validates the signature and checks for expired signatures.
 * 
 * @param creds - Firi API credentials
 * @param serverTime - Server epoch time in seconds from GET /time
 * @param validitySec - Signature validity period in seconds (default: 30)
 * @returns Properly formatted headers for Firi API authentication
 */
export function makeFiriHeaders(creds: FiriCreds, serverTime: number, validitySec = 30): FiriHeaders {
  // Validate inputs
  if (!creds.apiKey || !creds.clientId || !creds.secretPlain) {
    throw new Error('Missing required credentials: apiKey, clientId, and secretPlain are required')
  }
  
  if (typeof serverTime !== 'number' || serverTime <= 0) {
    throw new Error('Invalid server time: must be a positive number representing epoch seconds')
  }
  
  if (typeof validitySec !== 'number' || validitySec <= 0 || validitySec > 3600) {
    throw new Error('Invalid validity: must be between 1 and 3600 seconds')
  }

  const timestamp = String(serverTime) // epoch seconds from GET /time
  const validity = String(validitySec)
  const payload = `${timestamp}${validity}` // Canonical payload format per Firi docs
  
  // Generate HMAC-SHA256 signature using the secret key
  const sig = crypto.createHmac('sha256', creds.secretPlain).update(payload).digest('hex')
  
  return {
    'API-key': creds.apiKey,
    clientID: creds.clientId,
    timestamp,
    validity,
    'HMAC_encrypted_secretKey': sig,
  }
}

/**
 * Test helper: Generate deterministic signature for testing
 * This function allows testing with known timestamps for reproducible results
 */
export function makeFiriHeadersForTest(creds: FiriCreds, timestamp: number, validitySec = 30): FiriHeaders {
  return makeFiriHeaders(creds, timestamp, validitySec)
}

/**
 * Validate that headers are properly formatted for Firi API
 * @param headers - Headers to validate
 * @returns true if valid, throws error if invalid
 */
export function validateFiriHeaders(headers: FiriHeaders): boolean {
  if (!headers['API-key'] || !headers.clientID || !headers.timestamp || 
      !headers.validity || !headers['HMAC_encrypted_secretKey']) {
    throw new Error('Missing required headers')
  }
  
  if (!/^\d+$/.test(headers.timestamp)) {
    throw new Error('Invalid timestamp format: must be numeric epoch seconds')
  }
  
  if (!/^\d+$/.test(headers.validity)) {
    throw new Error('Invalid validity format: must be numeric seconds')
  }
  
  if (!/^[a-f0-9]{64}$/.test(headers['HMAC_encrypted_secretKey'])) {
    throw new Error('Invalid HMAC format: must be 64-character hex string')
  }
  
  return true
}

/**
 * Get the current signature payload for debugging
 * @param timestamp - Server epoch time
 * @param validity - Validity period in seconds
 * @returns The exact string that gets signed
 */
export function getSignaturePayload(timestamp: number, validity: number): string {
  return `${timestamp}${validity}`
}
