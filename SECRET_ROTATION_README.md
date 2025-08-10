# 🔐 Secret Rotation System

The Arklier Finance project includes a comprehensive secret rotation system that automatically manages and rotates sensitive credentials like API keys, encryption keys, and JWT secrets.

## 🚀 Quick Start

### 1. Generate Required Secrets

First, generate the encryption key and other required secrets:

```bash
pnpm run rotation:generate-secrets
```

This will output:
- `SECRETS_ENC_KEY` (64-character hex string)
- Sample JWT, API key, and API secret values

### 2. Set Up Environment Variables

Create a `.env.local` file with the generated values:

```bash
# Copy the generated SECRETS_ENC_KEY
SECRETS_ENC_KEY=ea85a47058faa927b6744574460f8fad5edd6f7c8dbc483f95e87a1dc0767caa

# Add your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: Add your actual secrets
JWT_SECRET=your_jwt_secret_here
API_KEY=your_api_key_here
API_SECRET=your_api_secret_here
```

### 3. Verify Setup

Check that all environment variables are properly set:

```bash
pnpm run rotation:env-check
```

### 4. Run Basic Tests

Test the system components:

```bash
pnpm run rotation:test
```

### 5. Initialize the System

Initialize the secret rotation system in your database:

```bash
pnpm run rotation:init
```

## 📋 Available Commands

### CLI Commands

```bash
# Check environment variables
pnpm run rotation:env-check

# Run basic tests
pnpm run rotation:test

# Initialize the system
pnpm run rotation:init

# Check rotation status
pnpm run rotation:status

# View rotation history
pnpm run rotation:history

# View rotation schedules
pnpm run rotation:schedules

# View rotation statistics
pnpm run rotation:stats

# Trigger manual rotation
pnpm run rotation:rotate <secret_type>

# Update rotation policy
pnpm run rotation:policy <secret_type> <max_age_days> <warning_days>

# Get active secret
pnpm run rotation:active <secret_type>

# Show help
pnpm run rotation:help
```

### Direct CLI Usage

```bash
npx tsx src/lib/crypto/rotation-cli.ts [command]
npx tsx src/lib/crypto/test-rotation.ts
```

## 🏗️ System Architecture

### Core Components

1. **SecretRotationService** (`src/lib/crypto/secret-rotation.ts`)
   - Main service for managing secret rotation
   - Handles encryption/decryption of secrets
   - Manages rotation policies and schedules

2. **Initialization System** (`src/lib/crypto/init-rotation.ts`)
   - Sets up default rotation policies
   - Creates initial rotation schedules
   - Establishes system configuration

3. **Secrets Management** (`src/lib/crypto/secrets.ts`)
   - Encrypts and decrypts secrets using AES-256-GCM
   - Generates random secrets
   - Manages encryption key rotation

4. **CLI Interface** (`src/lib/crypto/rotation-cli.ts`)
   - Command-line interface for system management
   - Environment validation
   - User-friendly error messages

5. **Test Suite** (`src/lib/crypto/test-rotation.ts`)
   - Independent testing of system components
   - Environment validation
   - Basic functionality verification

### Database Schema

The system uses several tables:

- `secret_rotation_policies` - Defines rotation rules for each secret type
- `secret_versions` - Stores encrypted versions of secrets
- `rotation_history` - Tracks all rotation events
- `rotation_schedules` - Manages automatic rotation timing

## 🔒 Security Features

### Encryption

- **AES-256-GCM** encryption for all secrets
- **Authenticated encryption** with integrity verification
- **Key derivation** from master encryption key
- **Secure random generation** for all secrets

### Access Control

- **Service role authentication** for database access
- **Environment variable validation** before execution
- **Secure logging** with sensitive data masking
- **Audit trails** for all rotation events

### Rotation Policies

- **Configurable intervals** for each secret type
- **Automatic rotation** with manual approval options
- **Emergency rotation** procedures
- **Warning notifications** before expiration

## 🚨 Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```bash
   pnpm run rotation:env-check
   ```
   - Ensure all required variables are set in `.env.local`
   - Check that `SECRETS_ENC_KEY` is exactly 64 characters

2. **Database Connection Issues**
   ```bash
   pnpm run rotation:test
   ```
   - Verify Supabase is running
   - Check credentials in `.env.local`
   - Ensure database tables exist

3. **Encryption Key Issues**
   ```bash
   pnpm run rotation:generate-secrets
   ```
   - Generate a new `SECRETS_ENC_KEY`
   - Ensure it's a valid 64-character hex string

### Error Messages

- **"Missing required environment variables"** - Check `.env.local`
- **"SECRETS_ENC_KEY must be a 64-character hex string"** - Regenerate the key
- **"Database connection failed"** - Check Supabase credentials and status
- **"Failed to load crypto modules"** - Verify Node.js crypto support

## 🔄 Integration with Supabase

### Edge Functions

The system is designed to work with Supabase Edge Functions:

- **Environment variables** are automatically available
- **Service role access** for database operations
- **Secure execution** in isolated environment

### Database Operations

- **Automatic table creation** during initialization
- **Migration support** for schema updates
- **Real-time monitoring** of rotation status

## 📚 API Reference

### SecretRotationService

```typescript
class SecretRotationService {
  // Check if rotation is needed
  async checkRotationNeeded(secretType: string): Promise<RotationCheckResult>
  
  // Rotate a secret
  async rotateSecret(secretType: string, newSecret: string, method?: string): Promise<RotationResult>
  
  // Get rotation history
  async getRotationHistory(secretType: string, limit?: number, offset?: number): Promise<RotationHistory[]>
  
  // Update rotation policy
  async updateRotationPolicy(secretType: string, updates: Partial<RotationPolicy>): Promise<boolean>
  
  // Get active secret
  async getActiveSecret(secretType: string): Promise<Buffer | null>
}
```

### CLI Functions

```typescript
// Initialize system
await initializeSecretRotation()

// Check environment
checkEnvironment(): boolean

// Load crypto modules
loadCryptoModules(): Promise<CryptoModules>
```

## 🎯 Best Practices

### Secret Management

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate secrets regularly** according to security policies
4. **Monitor rotation status** and respond to warnings

### System Administration

1. **Test in development** before production deployment
2. **Backup encryption keys** securely
3. **Monitor system logs** for rotation events
4. **Review rotation policies** periodically

### Security Considerations

1. **Limit access** to rotation system
2. **Audit all changes** to rotation policies
3. **Use strong encryption** for all secrets
4. **Implement monitoring** for failed rotations

## 🔗 Related Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [AES Encryption Standards](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
- [Secret Rotation Best Practices](https://owasp.org/www-project-cheat-sheets/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## 🆘 Support

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Run the test suite** to identify problems
3. **Verify environment setup** with `env-check`
4. **Review system logs** for detailed error information

For additional help, refer to the project documentation or create an issue in the project repository.
