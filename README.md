# Arklier Finance

A modern personal finance management application built with Next.js, Supabase, and shadcn/ui.

## Features

- 🎨 Modern, responsive UI with dark/light theme support
- 🔐 Supabase authentication and database integration
- 📊 Financial dashboard with charts and analytics
- 💰 Transaction management and categorization
- 🎯 Goal setting and tracking
- 📱 Mobile-first design with sidebar navigation

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **State Management**: React hooks + Supabase
- **Icons**: Lucide React
- **Themes**: next-themes

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended)
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd arklier-finance
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

5. Run the development server:
```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css     # Global styles and CSS variables
│   ├── layout.tsx      # Root layout with theme provider
│   └── page.tsx        # Home page
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── layout/         # Layout components (sidebar, main layout)
│   ├── blocks/         # Feature-specific components
│   ├── icons/          # Custom icon components
│   └── providers/      # Context providers
├── lib/                # Utility functions and configurations
│   ├── supabase/       # Supabase client configurations
│   └── utils.ts        # Utility functions
└── hooks/              # Custom React hooks
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Supabase Setup

1. Create a new Supabase project
2. Set up authentication (enable email/password)
3. Create necessary database tables for:
   - Users (handled by Supabase Auth)
   - Accounts
   - Transactions
   - Categories
   - Goals
4. Set up Row Level Security (RLS) policies
5. Configure environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
