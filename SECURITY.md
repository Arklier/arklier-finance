# Security Documentation

## Overview

This document outlines the security measures implemented in Arklier Finance to protect sensitive data, particularly API credentials and user secrets.

## Security Architecture

### 1. Secret Encryption

All sensitive data (API keys, secrets, tokens) are encrypted using AES-256-GCM encryption before storage in the database.

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Length**: 256 bits (32 bytes)
- **IV Length**: 96 bits (12 bytes)
- **Authentication Tag**: 128 bits (16 bytes)
- **Total Overhead**: 28 bytes per encrypted secret

#### Key Management

- Encryption keys are stored in environment variables (`SECRETS_ENC_KEY`)
- Keys must be exactly 64 hexadecimal characters (32 bytes)
- Keys are validated on application startup
- Different keys should be used for development, staging, and production

#### Key Generation

```bash
# Generate a new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Secure Logging

All logging is performed through a secure logging utility that:

- **Sanitizes Input**: Automatically removes potential secrets from log messages
- **Audit Trail**: Maintains detailed audit logs for security-sensitive operations
- **No Secret Exposure**: Ensures secrets are never logged, even in error messages
- **Pattern Recognition**: Identifies and redacts common secret patterns

#### Logging Patterns

The secure logger automatically detects and redacts:
- API keys and secrets
- Passwords and tokens
- Long hexadecimal strings
- Stripe-like key patterns

#### Audit Events

All security-sensitive operations are logged with:
- Timestamp
- User ID (when applicable)
- Action performed
- Resource accessed
- Success/failure status
- Processing time
- Sanitized metadata

### 3. Environment Variable Security

#### Required Variables

- `SECRETS_ENC_KEY`: 32-byte encryption key (64 hex characters)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

#### Validation

- All environment variables are validated on startup
- Invalid or missing variables cause application startup to fail
- Environment-specific warnings are provided
- Production environment blocks localhost URLs

### 4. Database Security

#### Row Level Security (RLS)

All tables have RLS policies that ensure:
- Users can only access their own data
- API operations use service role keys for elevated access
- No cross-user data leakage

#### Encrypted Storage

- API secrets are stored as encrypted bytea in PostgreSQL
- Encryption is performed at the application level
- Database administrators cannot access plaintext secrets

### 5. API Security

#### Authentication

- All API endpoints require valid Supabase authentication
- User sessions are validated on each request
- Unauthenticated requests are rejected with 401 status

#### Input Validation

- All input is validated for type and length
- Reasonable limits are enforced on field sizes
- Malformed requests are rejected with 400 status

#### Error Handling

- Error messages never expose internal details
- Secrets are never included in error responses
- Generic error messages for security-sensitive failures

## Security Best Practices

### 1. Development

- Never commit `.env.local` files to version control
- Use different encryption keys for different environments
- Regularly rotate development keys
- Test with realistic but non-production data

### 2. Production

- Store encryption keys in secure secret management systems
- Use environment-specific encryption keys
- Regularly rotate production keys
- Monitor audit logs for suspicious activity
- Implement rate limiting for API endpoints

### 3. Key Rotation

When rotating encryption keys:

1. Generate new key using the key generation command
2. Update environment variable
3. Re-encrypt all existing secrets with new key
4. Verify decryption works with new key
5. Remove old key from environment

### 4. Monitoring

- Review audit logs regularly
- Monitor for failed authentication attempts
- Track API usage patterns
- Alert on unusual activity

## Security Checklist

### Pre-Deployment

- [ ] All environment variables are set and valid
- [ ] Encryption key is properly generated and stored
- [ ] RLS policies are enabled on all tables
- [ ] Secure logging is implemented throughout
- [ ] No secrets are exposed in error messages
- [ ] Input validation is implemented on all endpoints

### Post-Deployment

- [ ] Audit logs are being generated
- [ ] No secrets appear in application logs
- [ ] Authentication is working correctly
- [ ] RLS policies are enforcing access control
- [ ] Encryption/decryption is working properly

## Incident Response

### 1. Suspected Secret Exposure

1. **Immediate Action**: Rotate affected encryption keys
2. **Investigation**: Review audit logs for unauthorized access
3. **Assessment**: Determine scope of potential exposure
4. **Notification**: Inform affected users if necessary
5. **Prevention**: Implement additional security measures

### 2. Unauthorized Access

1. **Containment**: Revoke affected user sessions
2. **Investigation**: Review access logs and audit trails
3. **Assessment**: Determine method of unauthorized access
4. **Remediation**: Fix security vulnerabilities
5. **Monitoring**: Increase monitoring for similar attempts

## Compliance

### Data Protection

- All sensitive data is encrypted at rest
- Access is logged and auditable
- User consent is required for data processing
- Data retention policies are enforced

### Privacy

- No personal data is logged
- User identifiers are anonymized in logs where possible
- Data minimization principles are followed
- User rights to data access and deletion are supported

## Contact

For security-related questions or to report security issues:

- **Security Team**: [Contact Information]
- **Bug Bounty**: [Program Details]
- **Disclosure Policy**: [Policy Details]

---

**Last Updated**: January 2025
**Version**: 1.0
**Review Schedule**: Quarterly
