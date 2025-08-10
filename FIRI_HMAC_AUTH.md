# Firi HMAC Authentication Implementation

This document describes the implementation of Firi's HMAC authentication system in the Arklier Finance application.

## Overview

Firi's API uses HMAC-SHA256 authentication with the following components:
- **API Key**: Your Firi API key
- **Client ID**: Your Firi client identifier  
- **Secret Key**: Your Firi secret key (used for HMAC signing)
- **Timestamp**: Server epoch time from `/time` endpoint
- **Validity**: Signature validity period in seconds

## Authentication Flow

1. **Get Server Time**: Call `GET /time` to get the current server epoch time
2. **Generate Payload**: Create signature payload as JSON string containing `timestamp`, `validity`, and optionally the request body
3. **Calculate HMAC**: Generate HMAC-SHA256 signature using your secret key
4. **Set Headers**: Include all required headers in the request
5. **Add Query Params**: Include `timestamp` and `validity` as query parameters

## Implementation Details

### Core Functions

#### `makeFiriHeaders(creds, serverTime, validitySec, requestBody?)`
Generates complete authentication headers for Firi API requests.

**Parameters:**
- `creds`: Object containing `apiKey`, `clientId`, and `secretPlain`
- `serverTime`: Server epoch time in seconds (from `/time` endpoint)
- `validitySec`: Signature validity period in seconds (default: 30, max: 3600)
- `requestBody`: Optional request body for POST requests (included in signature)

**Returns:**
```typescript
{
  'firi-access-key': string,
  'firi-user-clientid': string,
  'firi-user-signature': string
}
```

#### `validateFiriHeaders(headers)`
Validates that headers are properly formatted before sending requests.

#### `getSignaturePayload(timestamp, validity, requestBody?)`
Returns the exact string that gets signed for debugging purposes.

### Signature Calculation

The HMAC signature is calculated as:
```javascript
const payload = JSON.stringify({
  timestamp: String(timestamp),
  validity: String(validity),
  ...requestBody
})
const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex')
```

**Example for GET request:**
- Timestamp: `1640995200`
- Validity: `30`
- Payload: `{"timestamp":"1640995200","validity":"30"}`
- Result: 64-character hex string

**Example for POST request (order creation):**
- Timestamp: `1640995200`
- Validity: `2000`
- Request Body: `{"market":"BTCNOK","price":"1000","amount":"1","type":"ask"}`
- Payload: `{"timestamp":"1640995200","validity":"2000","market":"BTCNOK","price":"1000","amount":"1","type":"ask"}`
- Result: 64-character hex string

### Header Format

All requests to Firi's API must include these headers:

```
firi-access-key: your-api-key
firi-user-clientid: your-client-id
firi-user-signature: 5e055f335bd759d71c53d261fdfa6ac20668714847648b957c3d903bd03d1da8
```

### Query Parameters

All requests must include these query parameters:

```
?timestamp=1640995200&validity=30
```

## Usage Examples

### Basic GET Request
```typescript
import { makeFiriHeaders } from '@/lib/firi/sign'
import { firiTime } from '@/lib/firi/fetch'

const creds = {
  apiKey: 'your-api-key',
  clientId: 'your-client-id',
  secretPlain: 'your-secret-key'
}

// Get fresh server time
const serverTime = await firiTime()

// Generate headers (no request body for GET)
const headers = makeFiriHeaders(creds, serverTime, 60)

// Make request with query parameters
const url = `https://api.firi.com/v2/history/transactions?timestamp=${serverTime}&validity=60`
const response = await fetch(url, { headers })
```

### POST Request with Body
```typescript
// For POST requests, include the request body in the signature
const orderData = {
  market: 'BTCNOK',
  price: '1000',
  amount: '1',
  type: 'ask'
}

const headers = makeFiriHeaders(creds, serverTime, 60, orderData)

const response = await fetch(
  `https://api.firi.com/v2/orders?timestamp=${serverTime}&validity=60`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify(orderData)
  }
)
```

### Using the Fetch Utility
```typescript
import { firiFetchJson } from '@/lib/firi/fetch'

// GET request
const transactions = await firiFetchJson(
  'https://api.firi.com/v2/history/transactions',
  creds
)

// POST request
const orderResult = await firiFetchJson(
  'https://api.firi.com/v2/orders',
  creds,
  {
    method: 'POST',
    body: JSON.stringify(orderData)
  }
)
```

## Error Handling

The implementation includes comprehensive error handling:

- **Authentication Errors (401)**: Detailed error messages with signature details
- **Rate Limiting (429)**: Automatic retry with exponential backoff
- **Server Errors (5xx)**: Retry logic with configurable attempts
- **Validation Errors**: Input validation before making requests

### Common Error Scenarios

1. **Invalid Credentials**: Check API key, client ID, and secret
2. **Expired Signature**: Ensure server time is fresh and validity period is appropriate
3. **Rate Limiting**: Respect 10 requests per second limit
4. **Network Issues**: Automatic retry with exponential backoff

## Security Considerations

1. **Secret Storage**: API secrets are encrypted using AES-256-GCM before storage
2. **Time Synchronization**: Always use server time from `/time` endpoint
3. **Signature Validity**: Keep validity periods short (30-60 seconds recommended)
4. **Credential Rotation**: Regularly rotate API keys and secrets
5. **Request Body Signing**: Always include request body in signature for POST requests

## Testing

The implementation includes comprehensive testing:

- **Input Validation**: Ensures all required fields are present and valid
- **Header Validation**: Verifies header format and HMAC structure
- **Signature Consistency**: Confirms HMAC calculation matches expected results
- **Error Handling**: Tests various error scenarios and edge cases

### Running Tests
```bash
node scripts/test-firi-hmac.js
```

This test script verifies:
- Basic signature generation
- POST request body signing
- Signature format validation
- Validity period handling
- Signature consistency
- Request body variations
- Firi docs compliance
- Error handling

## Rate Limiting

Firi's API has a rate limit of 10 requests per second. The implementation includes:

- **Request Tracking**: Monitors request frequency within time windows
- **Automatic Throttling**: Prevents exceeding rate limits
- **Retry Logic**: Handles rate limit responses with appropriate delays

## Best Practices

1. **Always use server time**: Never rely on client time for signatures
2. **Keep validity short**: Use 30-60 seconds for most requests
3. **Handle errors gracefully**: Implement proper error handling and logging
4. **Monitor rate limits**: Track API usage to avoid hitting limits
5. **Validate responses**: Check response status and handle errors appropriately
6. **Include request body**: Always sign the complete request body for POST requests

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check credentials and ensure signature is not expired
2. **Rate Limit Exceeded**: Implement proper request spacing
3. **Invalid Signature**: Verify server time and secret key
4. **Network Timeouts**: Check internet connection and API endpoint availability

### Debug Information

The implementation provides detailed logging for debugging:

- Request URLs and parameters
- Generated headers and signatures
- Server responses and error details
- Rate limiting and retry information
- Request body signing details

## API Endpoints

The following endpoints are currently implemented:

- **Connect**: `/api/exchanges/firi/connect` - Store API credentials
- **Sync**: `/api/exchanges/firi/sync` - Synchronize transaction data
- **Time**: `https://api.firi.com/time` - Get server time

## Future Enhancements

Potential improvements for the HMAC implementation:

1. **Caching**: Cache server time with TTL to reduce API calls
2. **Batch Signing**: Support for signing multiple requests efficiently
3. **Metrics**: Track authentication success/failure rates
4. **Webhook Support**: Handle Firi webhook authentication
5. **Multi-Exchange**: Extend to support other exchanges with similar auth

## References

- [Firi API Documentation](https://api.firi.com)
- [HMAC-SHA256 Specification](https://tools.ietf.org/html/rfc2104)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
