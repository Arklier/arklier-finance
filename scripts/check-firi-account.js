#!/usr/bin/env node

/**
 * Simple script to check Firi account for transactions
 * Run this with your real Firi credentials to see what's in your account
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const crypto = require('crypto')

// Get credentials from environment variables
const CREDS = {
  apiKey: process.env.FIRI_API_KEY,
  clientId: process.env.FIRI_CLIENT_ID,
  secretPlain: process.env.FIRI_SECRET
}

// Check if credentials are available
if (!CREDS.apiKey || !CREDS.clientId || !CREDS.secretPlain) {
  console.log('❌ Missing Firi credentials!')
  console.log('Please set the following environment variables in .env.local:')
  console.log('  FIRI_API_KEY=your_api_key')
  console.log('  FIRI_CLIENT_ID=your_client_id')
  console.log('  FIRI_SECRET=your_secret')
  console.log('\nOr run this script with:')
  console.log('  FIRI_API_KEY=xxx FIRI_CLIENT_ID=xxx FIRI_SECRET=xxx node scripts/check-firi-account.js')
  process.exit(1)
}

// HMAC signature generation
function makeFiriHeaders(creds, serverTime, endpoint = '') {
  const timestamp = Math.floor(serverTime / 1000)
  const validity = 60
  
  const payload = `${timestamp}${validity}${endpoint}`
  const sig = crypto.createHmac('sha256', creds.secretPlain).update(payload).digest('hex')

  return {
    'API-key': creds.apiKey,
    clientID: creds.clientId,
    timestamp: timestamp.toString(),
    validity: validity.toString(),
    'HMAC_encrypted_secretKey': sig
  }
}

// Check account data
async function checkFiriAccount() {
  console.log('🔍 Checking Firi account...\n')
  
  try {
    // 1. Get server time
    console.log('1️⃣ Getting server time...')
    const timeResponse = await fetch('https://api.firi.com/time')
    if (!timeResponse.ok) {
      throw new Error(`Failed to get server time: ${timeResponse.status}`)
    }
    const timeData = await timeResponse.json()
    const serverTime = timeData.time
    console.log(`✅ Server time: ${new Date(serverTime).toISOString()}`)
    
    // 2. Check transactions
    console.log('\n2️⃣ Checking transactions...')
    const txHeaders = makeFiriHeaders(CREDS, serverTime, '/v2/history/transactions')
    const txResponse = await fetch('https://api.firi.com/v2/history/transactions?page=0&limit=100', {
      headers: {
        'Content-Type': 'application/json',
        ...txHeaders
      }
    })
    
    if (txResponse.ok) {
      const transactions = await txResponse.json()
      console.log(`✅ Found ${transactions.length} transactions`)
      if (transactions.length > 0) {
        console.log('📝 First transaction:', {
          id: transactions[0].id,
          date: transactions[0].created_at || transactions[0].date || 'unknown',
          type: transactions[0].type || 'unknown'
        })
      }
    } else {
      const errorText = await txResponse.text()
      console.log(`❌ Transactions failed: ${txResponse.status} - ${errorText}`)
    }
    
    // 3. Check deposits
    console.log('\n3️⃣ Checking deposits...')
    const depHeaders = makeFiriHeaders(CREDS, serverTime, '/v2/deposit/history')
    const depResponse = await fetch('https://api.firi.com/v2/deposit/history?page=0&limit=100', {
      headers: {
        'Content-Type': 'application/json',
        ...depHeaders
      }
    })
    
    if (depResponse.ok) {
      const deposits = await depResponse.json()
      console.log(`✅ Found ${deposits.length} deposits`)
    } else {
      const errorText = await depResponse.text()
      console.log(`❌ Deposits failed: ${depResponse.status} - ${errorText}`)
    }
    
    // 4. Check orders
    console.log('\n4️⃣ Checking orders...')
    const ordHeaders = makeFiriHeaders(CREDS, serverTime, '/v2/orders/history')
    const ordResponse = await fetch('https://api.firi.com/v2/orders/history?page=0&limit=100', {
      headers: {
        'Content-Type': 'application/json',
        ...ordHeaders
      }
    })
    
    if (ordResponse.ok) {
      const orders = await ordResponse.json()
      console.log(`✅ Found ${orders.length} orders`)
    } else {
      const errorText = await ordResponse.text()
      console.log(`❌ Orders failed: ${ordResponse.status} - ${errorText}`)
    }
    
    // 5. Check if there are more pages
    console.log('\n5️⃣ Checking for more data...')
    if (txResponse.ok) {
      const transactions = await txResponse.json()
      if (transactions.length === 100) {
        console.log('📄 Found 100 transactions - there might be more pages available')
        console.log('💡 The full sync will fetch all pages automatically')
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking account:', error.message)
  }
}

// Run the check
checkFiriAccount().then(() => {
  console.log('\n✨ Account check complete!')
  console.log('\nIf you see transactions, the API is working correctly.')
  console.log('If you get errors, check your credentials and try again.')
}).catch(console.error)
