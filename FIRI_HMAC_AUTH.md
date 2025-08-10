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
2. **Generate Payload**: Create signature payload as `${timestamp}${validity}`
3. **Calculate HMAC**: Generate HMAC-SHA256 signature using your secret key
4. **Set Headers**: Include all required headers in the request

## Implementation Details

### Core Functions

#### `makeFiriHeaders(creds, serverTime, validitySec)`
Generates complete authentication headers for Firi API requests.

**Parameters:**
- `creds`: Object containing `apiKey`, `clientId`, and `secretPlain`
- `serverTime`: Server epoch time in seconds (from `/time` endpoint)
- `validitySec`: Signature validity period in seconds (default: 30, max: 3600)

**Returns:**
```typescript
{
  'API-key': string,
  clientID: string,
  timestamp: string,
  validity: string,
  'HMAC_encrypted_secretKey': string
}
```

#### `validateFiriHeaders(headers)`
Validates that headers are properly formatted before sending requests.

#### `getSignaturePayload(timestamp, validity)`
Returns the exact string that gets signed for debugging purposes.

### Signature Calculation

The HMAC signature is calculated as:
```javascript
const payload = `${timestamp}${validity}`
const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex')
```

**Example:**
- Timestamp: `1640995200`
- Validity: `30`
- Payload: `"164099520030"`
- Result: 64-character hex string

### Header Format

All requests to Firi's API must include these headers:

```
API-key: your-api-key
clientID: your-client-id
timestamp: 1640995200
validity: 30
HMAC_encrypted_secretKey: 5e055f335bd759d71c53d261fdfa6ac20668714847648b957c3d903bd03d1da8
```

## Usage Examples

### Basic Request
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

// Generate headers
const headers = makeFiriHeaders(creds, serverTime, 60)

// Make request
const response = await fetch('https://api.firi.com/v2/history/transactions', {
  headers
})
```

### Using the Fetch Utility
```typescript
import { firiFetchJson } from '@/lib/firi/fetch'

const transactions = await firiFetchJson(
  'https://api.firi.com/v2/history/transactions',
  creds
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

## Testing

The implementation includes comprehensive testing:

- **Input Validation**: Ensures all required fields are present and valid
- **Header Validation**: Verifies header format and HMAC structure
- **Signature Consistency**: Confirms HMAC calculation matches expected results
- **Error Handling**: Tests various error scenarios and edge cases

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
