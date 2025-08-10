#!/usr/bin/env node

/**
 * Test script for Firi API markets endpoint
 * This script tests the markets endpoint without authentication
 */

async function testFiriMarkets() {
  console.log('🏪 Testing Firi API markets endpoint...')
  
  try {
    // Test the markets endpoint directly (should be public)
    const response = await fetch('https://api.firi.com/markets')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('✅ Firi markets endpoint response received')
    
    if (Array.isArray(data)) {
      console.log(`📊 Found ${data.length} markets`)
      
      // Show first few markets as examples
      const sampleMarkets = data.slice(0, 5)
      console.log('📋 Sample markets:')
      sampleMarkets.forEach((market, index) => {
        console.log(`  ${index + 1}. ${market.market || market.id || 'Unknown'}: ${market.base || 'N/A'}/${market.quote || 'N/A'}`)
      })
      
      // Check market structure
      if (data.length > 0) {
        const firstMarket = data[0]
        const requiredFields = ['market', 'base', 'quote']
        const missingFields = requiredFields.filter(field => !firstMarket[field])
        
        if (missingFields.length === 0) {
          console.log('✅ Market structure looks correct')
        } else {
          console.log('⚠️  Missing fields in market structure:', missingFields)
        }
      }
      
    } else if (data && typeof data === 'object') {
      console.log('📊 Markets response is an object')
      console.log('Keys:', Object.keys(data))
      
      // Check if it's a paginated response
      if (data.data && Array.isArray(data.data)) {
        console.log(`📊 Found ${data.data.length} markets in paginated response`)
      }
    } else {
      console.log('❌ Unexpected markets response format')
    }
    
  } catch (error) {
    console.error('❌ Firi markets endpoint test failed:', error.message)
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 Network issue - check internet connection')
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused - check if Firi API is accessible')
    }
  }
}

// Test with different endpoints
async function testOtherEndpoints() {
  console.log('\n🔄 Testing other Firi endpoints...')
  
  const endpoints = [
    'https://api.firi.com/time',
    'https://api.firi.com/markets',
    'https://api.firi.com/status'
  ]
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testing ${endpoint}...`)
      const response = await fetch(endpoint)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ ${endpoint} - Status: ${response.status}`)
        if (data && typeof data === 'object') {
          console.log(`   Response keys: ${Object.keys(data).join(', ')}`)
        }
      } else {
        console.log(`❌ ${endpoint} - Status: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`)
    }
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Firi API endpoints tests...\n')
  
  await testFiriMarkets()
  await testOtherEndpoints()
  
  console.log('\n🎉 API endpoints tests completed!')
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
}

module.exports = { testFiriMarkets, testOtherEndpoints }
