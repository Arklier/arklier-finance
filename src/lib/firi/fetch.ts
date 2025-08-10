import { makeFiriHeaders, validateFiriHeaders } from './sign'
import type { FiriCreds } from './sign'

export interface FiriFetchOptions {
  retries?: number
  baseDelay?: number
  maxDelay?: number
  jitter?: boolean
  rateLimitDelay?: number
}

export class FiriFetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: any,
    public authDetails?: {
      timestamp?: string
      validity?: string
      signaturePayload?: string
    }
  ) {
    super(message)
    this.name = 'FiriFetchError'
  }
}

// Enhanced rate limiting: max 6 requests per second (more conservative)
const RATE_LIMIT = {
  maxRequests: 6,
  windowMs: 1000,
  requests: [] as number[]
}

function checkRateLimit(): void {
  const now = Date.now()
  // Remove requests older than the window
  RATE_LIMIT.requests = RATE_LIMIT.requests.filter(time => now - time < RATE_LIMIT.windowMs)
  
  if (RATE_LIMIT.requests.length >= RATE_LIMIT.maxRequests) {
    const oldestRequest = RATE_LIMIT.requests[0]
    const waitTime = RATE_LIMIT.windowMs - (now - oldestRequest)
    throw new FiriFetchError(`Rate limit exceeded. Wait ${waitTime}ms`, 429, 'Too Many Requests')
  }
  
  RATE_LIMIT.requests.push(now)
}

function addJitter(delay: number): number {
  return delay + Math.random() * delay * 0.1
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function firiTime(): Promise<number> {
  try {
    const response = await fetch('https://api.firi.com/time')
    if (!response.ok) {
      throw new Error(`Failed to get server time: ${response.status}`)
    }
    const data = await response.json()
    return Number(data.time)
  } catch (error) {
    console.error('Error fetching Firi server time:', error)
    // Fallback to client time if server time fails
    return Math.floor(Date.now() / 1000)
  }
}

export async function firiFetch(
  url: string,
  creds: FiriCreds,
  options: RequestInit = {},
  fetchOptions: FiriFetchOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
    rateLimitDelay = 150
  } = fetchOptions

  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check rate limit before making request
      checkRateLimit()
      
      // Get fresh server time for each request to avoid expired signatures
      const serverTime = await firiTime()
      const headers = makeFiriHeaders(creds, serverTime, 60)
      
      // Validate headers before sending
      try {
        validateFiriHeaders(headers)
      } catch (validationError) {
        throw new FiriFetchError(
          `Header validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
          400,
          'Bad Request',
          undefined,
          {
            timestamp: headers.timestamp,
            validity: headers.validity,
            signaturePayload: `${headers.timestamp}${headers.validity}`
          }
        )
      }
      
      console.log(`[Firi] Making request to ${url} with timestamp ${serverTime}, validity 60s`)
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...headers
        }
      })
      
      // If successful, return immediately
      if (response.ok) {
        return response
      }
      
      // Handle specific error cases
      if (response.status === 401) {
        const authDetails = {
          timestamp: headers.timestamp,
          validity: headers.validity,
          signaturePayload: `${headers.timestamp}${headers.validity}`
        }
        
        // Try to get more details from the response
        let errorDetail = 'Authentication failed - check API credentials'
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorDetail = errorData.error || errorData.message
          }
        } catch {
          // Ignore JSON parsing errors
        }
        
        throw new FiriFetchError(
          errorDetail,
          401,
          'Unauthorized',
          undefined,
          authDetails
        )
      }
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('Retry-After')
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt)
        
        console.log(`[Firi] Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`)
        await delay(waitTime)
        
        // Add additional rate limit delay after 429
        await delay(rateLimitDelay)
        continue
      }
      
      if (response.status >= 500) {
        // Server error - retry with exponential backoff
        if (attempt < retries) {
          const waitTime = jitter 
            ? addJitter(Math.min(baseDelay * Math.pow(2, attempt), maxDelay))
            : Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
          
          console.log(`[Firi] Server error (${response.status}), waiting ${waitTime}ms before retry ${attempt + 1}/${retries}`)
          await delay(waitTime)
          continue
        }
      }
      
      // Non-retryable error
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new FiriFetchError(
        `Request failed: ${errorText}`,
        response.status,
        response.statusText,
        errorText
      )
      
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on authentication errors
      if (error instanceof FiriFetchError && error.status === 401) {
        throw error
      }
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw error
      }
      
      // Wait before retrying
      const waitTime = jitter 
        ? addJitter(Math.min(baseDelay * Math.pow(2, attempt), maxDelay))
        : Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      await delay(waitTime)
    }
  }
  
  throw lastError || new Error('Request failed after all retries')
}

// Helper for JSON responses
export async function firiFetchJson<T>(
  url: string,
  creds: FiriCreds,
  options: RequestInit = {},
  fetchOptions: FiriFetchOptions = {}
): Promise<T> {
  const response = await firiFetch(url, creds, options, fetchOptions)
  return response.json()
}

// Enhanced rate limiting utilities for sync operations
export class FiriRateLimiter {
  private requests: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly delayMs: number

  constructor(maxRequests = 6, windowMs = 1000, delayMs = 150) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.delayMs = delayMs
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now()
    
    // Remove old requests
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    
    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0]
      const waitTime = this.windowMs - (now - oldestRequest)
      await delay(waitTime)
    }
    
    // Record this request
    this.requests.push(Date.now())
    
    // Add delay between requests
    await delay(this.delayMs)
  }

  getStats() {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    
    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      delayMs: this.delayMs
    }
  }
}
