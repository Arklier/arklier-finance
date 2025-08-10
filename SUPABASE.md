# Supabase CLI Setup & Usage

This project is configured with Supabase CLI for local development and database management.

## Prerequisites

- Docker Desktop installed and running
- Supabase CLI installed (`brew install supabase/tap/supabase`)

## Project Setup

The project is already linked to the remote Supabase project: `arklier-finance` (ID: `tbluwnwjtajvviawwswo`)

## Available Scripts

### Development
```bash
# Start local Supabase stack (DB, Studio, Auth emulation)
pnpm supabase:start

# Stop local Supabase stack
pnpm supabase:stop

# Open Supabase Studio in browser
pnpm db:studio
```

### Database Management
```bash
# Generate TypeScript types from local database
pnpm db:gen

# Push local schema changes to remote database
pnpm db:push
```

### Manual CLI Commands
```bash
# Start local development environment
supabase start

# Stop local development environment
supabase stop

# Open Supabase Studio
supabase studio

# Generate types from remote database
supabase gen types typescript --project-id tbluwnwjtajvviawwswo > src/types/database.types.ts

# Generate types from local database (requires Docker)
supabase gen types typescript --local > src/types/database.types.ts

# Push local migrations to remote
supabase db push

# Pull remote schema to local
supabase db pull

# Create a new migration
supabase migration new <migration_name>

# Reset local database
supabase db reset
```

## Local Development Workflow

1. **Start local environment**: `pnpm supabase:start`
2. **Make schema changes** in `supabase/migrations/` or `supabase/schema.sql`
3. **Generate types**: `pnpm db:gen` (after starting local stack)
4. **Test locally** with your Next.js app
5. **Push to remote**: `pnpm db:push` when ready

## Configuration

The local configuration (`supabase/config.toml`) has been updated to match the remote project settings:
- Site URL: `http://localhost:3000`
- Email confirmations: enabled
- Rate limiting: configured for development

## Database Types

TypeScript types are automatically generated in `src/types/database.types.ts` and should be regenerated whenever the schema changes.

## Troubleshooting

- **Docker not running**: Start Docker Desktop before running `supabase start`
- **Port conflicts**: Check if ports 54321-54329 are available
- **Migration issues**: Use `supabase db reset` to start fresh locally
- **RLS issues**: Check Row Level Security policies in Supabase Studio
