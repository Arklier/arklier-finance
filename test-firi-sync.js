#!/usr/bin/env node

/**
 * Test script for Firi API connection and sync
 * This bypasses the web interface to test the core functionality
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Configuration
const SUPABASE_URL = 'https://tbluwnwjtajvviawwswo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibHV3bndqdGFqdnZpYXd3c3dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NDc3MTUsImV4cCI6MjA3MDQyMzcxNX0.Was5nI_Bzm0rKHNLljmBqT5xac2G32osAAV_smo0UeY'

// Firi credentials
const FIRI_CREDS = {
  apiKey: '841108a04584809b190ea4c2a44e0372dc0c0f2dddc8619a72d29c83dfdd25a9',
  clientId: '8ff14c7e59b873bb58cc65ba2ed45e433d5cf861f724b11b313f4049fcf45103',
  secret: '77fd525c1130d3074fccdafdd1c84087151048689e759af9e9327680cd95ef35'
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Generate HMAC signature for Firi API authentication
 * Based on: https://developers.firi.com/
 */
function generateFiriAuthHeaders() {
  // Get current timestamp in epoch (recommended by Firi)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  
  // Validity period (e.g., 60 seconds)
  const validity = '60'
  
  // Create the message to sign: timestamp + validity (per existing code)
  const message = timestamp + validity
  
  // Create HMAC signature using the secret key
  const signature = crypto
    .createHmac('sha256', FIRI_CREDS.secret)
    .update(message)
    .digest('hex')
  
  return {
    'API-key': FIRI_CREDS.apiKey,
    'HMAC_encrypted_secretKey': signature,
    'validity': validity,
    'timestamp': timestamp
  }
}

/**
 * Test Firi API connection
 */
async function testFiriConnection() {
  console.log('🔐 Testing Firi API connection...')
  
  try {
    // First get the server time to ensure our timestamp is correct
    const timeResponse = await fetch('https://api.firi.com/time')
    const timeData = await timeResponse.json()
    console.log('⏰ Server time:', timeData.time)
    
    // Test balances endpoint (requires authentication)
    const auth = generateFiriAuthHeaders()
    console.log('🔑 Auth headers:', auth.headers)
    
    // Try a simple GET request to balances
    const balancesUrl = new URL('https://api.firi.com/v2/balances')
    balancesUrl.searchParams.set('timestamp', auth.timestamp)
    balancesUrl.searchParams.set('validity', auth.validity)
    
    const balancesResponse = await fetch(balancesUrl.toString(), {
      method: 'GET',
      headers: auth.headers
    })
    
    console.log('📡 Response status:', balancesResponse.status)
    console.log('📡 Response headers:', Object.fromEntries(balancesResponse.headers.entries()))
    
    if (balancesResponse.ok) {
      const balances = await balancesResponse.json()
      console.log('✅ Balances fetched successfully:', balances)
      return true
    } else {
      const errorText = await balancesResponse.text()
      console.log('❌ Balances request failed:', balancesResponse.status, errorText)
      
      // Try to parse error as JSON
      try {
        const errorJson = JSON.parse(errorText)
        console.log('❌ Error details:', errorJson)
      } catch {
        console.log('❌ Raw error text:', errorText)
      }
      
      return false
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error.message)
    return false
  }
}

/**
 * Test fetching transactions from Firi
 */
async function testFiriTransactions() {
  console.log('\n📊 Testing Firi transactions fetch...')
  
  try {
    const auth = generateFiriAuthHeaders()
    
    // Fetch transactions (start from most recent)
    const transactionsUrl = new URL('https://api.firi.com/v2/history/transactions')
    transactionsUrl.searchParams.set('direction', 'end')
    transactionsUrl.searchParams.set('count', '10')
    transactionsUrl.searchParams.set('timestamp', auth.timestamp)
    transactionsUrl.searchParams.set('validity', auth.validity)
    
    const transactionsResponse = await fetch(transactionsUrl.toString(), {
      headers: auth.headers
    })
    
    if (transactionsResponse.ok) {
      const transactions = await transactionsResponse.json()
      console.log('✅ Transactions fetched successfully:')
      console.log(`📈 Found ${transactions.length} transactions`)
      
      if (transactions.length > 0) {
        console.log('📋 Sample transaction:', transactions[0])
      }
      
      return transactions
    } else {
      const errorText = await transactionsResponse.text()
      console.log('❌ Transactions request failed:', transactionsResponse.status, errorText)
      return null
    }
  } catch (error) {
    console.error('❌ Transactions test failed:', error.message)
    return null
  }
}

/**
 * Test fetching orders from Firi
 */
async function testFiriOrders() {
  console.log('\n📋 Testing Firi orders fetch...')
  
  try {
    const authHeaders = generateFiriAuthHeaders()
    
    // Fetch orders
    const ordersUrl = new URL('https://api.firi.com/v2/history/orders')
    ordersUrl.searchParams.set('count', '10')
    ordersUrl.searchParams.set('timestamp', timestamp)
    ordersUrl.searchParams.set('validity', validity)
    
    const ordersResponse = await fetch(ordersUrl.toString(), {
      headers: authHeaders
    })
    
    if (ordersResponse.ok) {
      const orders = await ordersResponse.json()
      console.log('✅ Orders fetched successfully:')
      console.log(`📈 Found ${orders.length} orders`)
      
      if (orders.length > 0) {
        console.log('📋 Sample order:', orders[0])
      }
      
      return orders
    } else {
      const errorText = await ordersResponse.text()
      console.log('❌ Orders request failed:', ordersResponse.status, errorText)
      return null
    }
  } catch (error) {
    console.error('❌ Orders test failed:', error.message)
    return null
  }
}

/**
 * Main test function
 */
async function testFiriSync() {
  console.log('🚀 Starting Firi API tests...\n')
  
  // Test connection
  const connectionOk = await testFiriConnection()
  if (!connectionOk) {
    console.log('\n❌ Connection failed, stopping tests')
    return
  }
  
  // Test transactions
  const transactions = await testFiriTransactions()
  
  // Test orders
  const orders = await testFiriOrders()
  
  console.log('\n🎯 Test Summary:')
  console.log(`Connection: ${connectionOk ? '✅' : '❌'}`)
  console.log(`Transactions: ${transactions ? `✅ (${transactions.length})` : '❌'}`)
  console.log(`Orders: ${orders ? `✅ (${orders.length})` : '❌'}`)
  
  if (transactions && transactions.length > 0) {
    console.log('\n🎉 SUCCESS: Found transactions in your Firi account!')
    console.log('You can now use the sync endpoint to import these into your database.')
  } else {
    console.log('\n📝 No transactions found or API issue. Check your credentials and try again.')
  }
}

// Run the test
testFiriSync()
