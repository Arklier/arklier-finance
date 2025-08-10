#!/usr/bin/env node

/**
 * Test script for Firi API time endpoint
 * This script tests the server time synchronization
 */

async function testFiriTime() {
  console.log('🕐 Testing Firi API time endpoint...')
  
  try {
    // Test the time endpoint directly
    const response = await fetch('https://api.firi.com/time')
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('✅ Firi time endpoint response:', data)
    
    if (data.time) {
      const serverTime = Number(data.time)
      const clientTime = Math.floor(Date.now() / 1000)
      const timeDiff = Math.abs(serverTime - clientTime)
      
      console.log('📊 Time comparison:')
      console.log('  Server time:', serverTime)
      console.log('  Client time:', clientTime)
      console.log('  Difference:', timeDiff, 'seconds')
      
      if (timeDiff < 60) {
        console.log('✅ Time difference is acceptable (< 60 seconds)')
      } else {
        console.log('⚠️  Time difference is large, may cause HMAC issues')
      }
      
      // Test HMAC with server time
      console.log('\n🧪 Testing HMAC with server time...')
      const testSecret = 'test-secret-key-12345'
      const validity = 60
      const payload = `${serverTime}${validity}`
      
      const crypto = require('crypto')
      const signature = crypto.createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex')
      
      console.log('  Payload:', payload)
      console.log('  HMAC signature:', signature.substring(0, 8) + '...')
      console.log('✅ HMAC generation with server time successful')
      
    } else {
      console.log('❌ No time field in response')
    }
    
  } catch (error) {
    console.error('❌ Firi time endpoint test failed:', error.message)
    
    if (error.code === 'ENOTFOUND') {
      console.log('💡 Network issue - check internet connection')
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused - check if Firi API is accessible')
    }
  }
}

// Test with different validity periods
async function testValidityPeriods() {
  console.log('\n🔄 Testing different validity periods...')
  
  try {
    const response = await fetch('https://api.firi.com/time')
    if (!response.ok) return
    
    const data = await response.json()
    const serverTime = Number(data.time)
    const testSecret = 'test-secret-key-12345'
    const crypto = require('crypto')
    
    const validityPeriods = [30, 60, 120, 300]
    
    validityPeriods.forEach(validity => {
      const payload = `${serverTime}${validity}`
      const signature = crypto.createHmac('sha256', testSecret)
        .update(payload)
        .digest('hex')
      
      console.log(`  Validity ${validity}s: ${payload} → ${signature.substring(0, 8)}...`)
    })
    
    console.log('✅ All validity periods tested successfully')
    
  } catch (error) {
    console.error('❌ Validity period test failed:', error.message)
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Firi time endpoint tests...\n')
  
  await testFiriTime()
  await testValidityPeriods()
  
  console.log('\n🎉 Time endpoint tests completed!')
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
}

module.exports = { testFiriTime, testValidityPeriods }
