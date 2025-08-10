#!/usr/bin/env node

/**
 * Example script showing how to use the updated Firi HMAC implementation
 * This demonstrates the correct way to make authenticated requests to Firi's API
 */

const crypto = require('crypto')

// Example credentials (replace with real ones)
const CREDS = {
  apiKey: 'your-firi-api-key',
  clientId: 'your-firi-client-id',
  secretPlain: 'your-firi-secret-key'
}

// Example server time (in production, get this from GET /time endpoint)
const SERVER_TIME = Math.round(Date.now() / 1000)
const VALIDITY = 60 // 60 seconds

console.log('🚀 Firi HMAC Authentication Example')
console.log('===================================\n')

// Example 1: GET request (e.g., fetching transactions)
console.log('📋 Example 1: GET Request (fetching transactions)')
console.log('------------------------------------------------')

const getRequestBody = {
  timestamp: SERVER_TIME.toString(),
  validity: VALIDITY.toString()
}

const getSignature = crypto.createHmac('sha256', CREDS.secretPlain)
  .update(JSON.stringify(getRequestBody))
  .digest('hex')

const getHeaders = {
  'firi-access-key': CREDS.apiKey,
  'firi-user-clientid': CREDS.clientId,
  'firi-user-signature': getSignature
}

console.log('Request URL:')
console.log(`GET https://api.firi.com/v2/history/transactions?timestamp=${SERVER_TIME}&validity=${VALIDITY}`)
console.log('\nHeaders:')
Object.entries(getHeaders).forEach(([key, value]) => {
  if (key === 'firi-user-signature') {
    console.log(`  ${key}: ${value.substring(0, 8)}...`)
  } else {
    console.log(`  ${key}: ${value}`)
  }
})
console.log('\nSignature payload:', JSON.stringify(getRequestBody))
console.log('✅ GET request example complete\n')

// Example 2: POST request (e.g., creating an order)
console.log('📋 Example 2: POST Request (creating an order)')
console.log('-----------------------------------------------')

const orderData = {
  market: 'BTCNOK',
  price: '1000',
  amount: '1',
  type: 'ask'
}

const postRequestBody = {
  timestamp: SERVER_TIME.toString(),
  validity: VALIDITY.toString(),
  ...orderData
}

const postSignature = crypto.createHmac('sha256', CREDS.secretPlain)
  .update(JSON.stringify(postRequestBody))
  .digest('hex')

const postHeaders = {
  'firi-access-key': CREDS.apiKey,
  'firi-user-clientid': CREDS.clientId,
  'firi-user-signature': postSignature
}

console.log('Request URL:')
console.log(`POST https://api.firi.com/v2/orders?timestamp=${SERVER_TIME}&validity=${VALIDITY}`)
console.log('\nHeaders:')
Object.entries(postHeaders).forEach(([key, value]) => {
  if (key === 'firi-user-signature') {
    console.log(`  ${key}: ${value.substring(0, 8)}...`)
  } else {
    console.log(`  ${key}: ${value}`)
  }
})
console.log('\nRequest Body:', JSON.stringify(orderData))
console.log('\nSignature payload:', JSON.stringify(postRequestBody))
console.log('✅ POST request example complete\n')

// Example 3: Using the utility functions
console.log('📋 Example 3: Using Utility Functions')
console.log('-------------------------------------')

function makeFiriHeaders(creds, serverTime, validitySec, requestBody = {}) {
  const payload = {
    timestamp: serverTime.toString(),
    validity: validitySec.toString(),
    ...requestBody
  }
  
  const signature = crypto.createHmac('sha256', creds.secretPlain)
    .update(JSON.stringify(payload))
    .digest('hex')
  
  return {
    'firi-access-key': creds.apiKey,
    'firi-user-clientid': creds.clientId,
    'firi-user-signature': signature
  }
}

function validateFiriHeaders(headers) {
  if (!headers['firi-access-key'] || !headers['firi-user-clientid'] || !headers['firi-user-signature']) {
    throw new Error('Missing required headers')
  }
  
  if (!/^[a-f0-9]{64}$/.test(headers['firi-user-signature'])) {
    throw new Error('Invalid HMAC format: must be 64-character hex string')
  }
  
  return true
}

// Test the utility functions
try {
  const testHeaders = makeFiriHeaders(CREDS, SERVER_TIME, VALIDITY, orderData)
  console.log('Generated headers using utility function:')
  Object.entries(testHeaders).forEach(([key, value]) => {
    if (key === 'firi-user-signature') {
      console.log(`  ${key}: ${value.substring(0, 8)}...`)
    } else {
      console.log(`  ${key}: ${value}`)
    }
  })
  
  validateFiriHeaders(testHeaders)
  console.log('✅ Header validation passed')
  
} catch (error) {
  console.error('❌ Header validation failed:', error.message)
}

console.log('\n🎯 Key Points to Remember')
console.log('==========================')
console.log('1. Always use server time from GET /time endpoint')
console.log('2. Include timestamp and validity as query parameters')
console.log('3. For POST requests, include the request body in the signature')
console.log('4. Keep validity periods short (30-60 seconds recommended)')
console.log('5. Validate headers before sending requests')
console.log('6. Handle authentication errors gracefully')

console.log('\n📚 Next Steps')
console.log('==============')
console.log('1. Replace placeholder credentials with real Firi API credentials')
console.log('2. Implement proper error handling and retry logic')
console.log('3. Add rate limiting (max 10 requests per second)')
console.log('4. Test with real Firi API endpoints')
console.log('5. Monitor authentication success/failure rates')

console.log('\n🚀 Your Firi HMAC implementation is ready!')
