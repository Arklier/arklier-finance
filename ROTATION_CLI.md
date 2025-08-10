# Secret Rotation CLI

A command-line interface for managing the secret rotation system in Arklier Finance.

## Overview

The secret rotation system automatically manages the lifecycle of sensitive secrets like API keys, encryption keys, and JWT secrets. This CLI provides commands to initialize, monitor, and manually control the rotation process.

## Prerequisites

- Node.js 18+ and pnpm installed
- Supabase project configured with proper environment variables
- Database migrations applied (secret rotation schema)

## Environment Variables

Make sure you have these environment variables set in your `.env.local`:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTION_KEY=your_encryption_key_for_secrets
```

## Installation

The CLI is included in the project. Install dependencies:

```bash
pnpm install
```

## Usage

### Quick Start

Initialize the secret rotation system:

```bash
pnpm run rotation:init
```

### Available Commands

#### Initialize System
```bash
pnpm run rotation:init
# or
npx tsx src/lib/crypto/rotation-cli.ts init
```

Initializes the secret rotation system with:
- Default rotation policies for all secret types
- Initial rotation schedules
- System configuration verification

#### Check Status
```bash
pnpm run rotation:status
# or
npx tsx src/lib/crypto/rotation-cli.ts status
```

Shows the current rotation status for all secret types.

#### View History
```bash
pnpm run rotation:history
# or
npx tsx src/lib/crypto/rotation-cli.ts history
```

Displays rotation history for all secret types.

#### View Schedules
```bash
pnpm run rotation:schedules
# or
npx tsx src/lib/crypto/rotation-cli.ts schedules
```

Shows upcoming rotation schedules.

#### View Statistics
```bash
pnpm run rotation:stats
# or
npx tsx src/lib/crypto/rotation-cli.ts stats
```

Displays rotation statistics and metrics.

#### Manual Rotation
```bash
pnpm run rotation:rotate <secret_type>
# or
npx tsx src/lib/crypto/rotation-cli.ts rotate <secret_type>
```

Examples:
```bash
pnpm run rotation:rotate api_key
pnpm run rotation:rotate encryption_key
pnpm run rotation:rotate jwt_secret
```

#### Update Policy
```bash
pnpm run rotation:policy <secret_type> <max_age_days> <warning_days>
# or
npx tsx src/lib/crypto/rotation-cli.ts policy <secret_type> <max_age_days> <warning_days>
```

Examples:
```bash
pnpm run rotation:policy api_key 90 30
pnpm run rotation:policy encryption_key 365 60
```

#### Get Active Secret
```bash
pnpm run rotation:active <secret_type>
# or
npx tsx src/lib/crypto/rotation-cli.ts active <secret_type>
```

Examples:
```bash
pnpm run rotation:active api_key
pnpm run rotation:active encryption_key
```

#### Help
```bash
pnpm run rotation:help
# or
npx tsx src/lib/crypto/rotation-cli.ts help
```

Shows detailed help and usage examples.

## Secret Types

The system supports these secret types:

- `api_key` - API keys for external services
- `api_secret` - API secrets for external services  
- `encryption_key` - Encryption keys for data
- `jwt_secret` - JWT signing secrets

## Default Policies

Each secret type has default rotation policies:

| Secret Type | Max Age | Warning Days | Auto Rotation |
|-------------|---------|--------------|---------------|
| api_key | 90 days | 30 days | ✅ Enabled |
| api_secret | 90 days | 30 days | ✅ Enabled |
| encryption_key | 365 days | 60 days | ✅ Enabled |
| jwt_secret | 180 days | 45 days | ✅ Enabled |

## How It Works

1. **Initialization**: Creates rotation policies and schedules
2. **Monitoring**: Continuously checks if secrets need rotation
3. **Automatic Rotation**: Rotates secrets based on policies
4. **Manual Control**: Allows manual rotation when needed
5. **Audit Trail**: Logs all rotation activities

## Security Features

- **Secret Sanitization**: Prevents secrets from being logged
- **Audit Logging**: Tracks all rotation activities
- **Encryption**: All secrets are encrypted at rest
- **Access Control**: Uses Supabase RLS policies
- **Rotation History**: Maintains complete audit trail

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   ```
   ❌ Failed to initialize secret rotation system: Missing required environment variables
   ```
   Solution: Check your `.env.local` file

2. **Database Connection Failed**
   ```
   ❌ Failed to initialize secret rotation system: Database connection failed
   ```
   Solution: Verify Supabase is running and credentials are correct

3. **Migration Not Applied**
   ```
   ❌ Failed to initialize secret rotation system: Table not found
   ```
   Solution: Run `pnpm run db:push` to apply migrations

### Debug Mode

For detailed logging, set the environment variable:

```bash
DEBUG=true pnpm run rotation:init
```

## Integration

The CLI integrates with:

- **Supabase**: Database and authentication
- **Next.js API Routes**: Web interface for rotation
- **Cron Jobs**: Automated rotation scheduling
- **Monitoring**: Health checks and alerts

## Development

To modify the CLI:

1. Edit `src/lib/crypto/rotation-cli.ts`
2. Add new commands to the `commands` array
3. Test with `pnpm run rotation:help`
4. Update this documentation

## Support

For issues or questions:

1. Check the logs: `pnpm run rotation:status`
2. Verify environment variables
3. Check database connectivity
4. Review migration status

## License

Part of the Arklier Finance project.
