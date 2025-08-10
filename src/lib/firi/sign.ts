import crypto from 'crypto'

export type FiriCreds = {
  apiKey: string
  clientId: string
  secretPlain: string
}

export type FiriHeaders = {
  'firi-access-key': string
  'firi-user-clientid': string
  'firi-user-signature': string
}

/**
 * Firi API authentication headers
 * Based on Firi API documentation, the HMAC signature is calculated as:
 * HMAC-SHA256(secret, JSON.stringify({timestamp, validity, ...requestBody}))
 * 
 * The server validates the signature and checks for expired signatures.
 * 
 * @param creds - Firi API credentials
 * @param serverTime - Server epoch time in seconds from GET /time
 * @param validitySec - Signature validity period in seconds (default: 30)
 * @param requestBody - Optional request body for POST requests
 * @returns Properly formatted headers for Firi API authentication
 */
export function makeFiriHeaders(creds: FiriCreds, serverTime: number, validitySec = 30, requestBody?: any): FiriHeaders {
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
  
  // Create the payload as JSON string per Firi docs
  // For POST requests, include the request body in the signature
  const payload = JSON.stringify({
    timestamp,
    validity,
    ...(requestBody || {})
  })
  
  // Generate HMAC-SHA256 signature using the secret key
  let sig: string
  try {
    sig = crypto.createHmac('sha256', creds.secretPlain).update(payload).digest('hex')
    
    // Debug logging for HMAC generation
    console.log('[Firi HMAC] Debug info:', {
      timestamp,
      validity,
      payload,
      secretLength: creds.secretPlain.length,
      signature: sig.substring(0, 8) + '...',
      apiKey: creds.apiKey.substring(0, 8) + '...',
      clientId: creds.clientId
    })
  } catch (error) {
    console.error('[Firi HMAC] Error generating signature:', error)
    throw new Error(`HMAC signature generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return {
    'firi-access-key': creds.apiKey,
    'firi-user-clientid': creds.clientId,
    'firi-user-signature': sig,
  }
}

/**
 * Test helper: Generate deterministic signature for testing
 * This function allows testing with known timestamps for reproducible results
 */
export function makeFiriHeadersForTest(creds: FiriCreds, timestamp: number, validitySec = 30, requestBody?: any): FiriHeaders {
  return makeFiriHeaders(creds, timestamp, validitySec, requestBody)
}

/**
 * Validate that headers are properly formatted for Firi API
 * @param headers - Headers to validate
 * @returns true if valid, throws error if invalid
 */
export function validateFiriHeaders(headers: FiriHeaders): boolean {
  if (!headers['firi-access-key'] || !headers['firi-user-clientid'] || !headers['firi-user-signature']) {
    throw new Error('Missing required headers')
  }
  
  if (!/^[a-f0-9]{64}$/.test(headers['firi-user-signature'])) {
    throw new Error('Invalid HMAC format: must be 64-character hex string')
  }
  
  return true
}

/**
 * Get the current signature payload for debugging
 * @param timestamp - Server epoch time
 * @param validity - Validity period in seconds
 * @param requestBody - Optional request body
 * @returns The exact string that gets signed
 */
export function getSignaturePayload(timestamp: number, validity: number, requestBody?: any): string {
  return JSON.stringify({
    timestamp: String(timestamp),
    validity: String(validity),
    ...(requestBody || {})
  })
}
