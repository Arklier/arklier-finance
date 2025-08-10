-- Initial schema migration
-- This is a sample migration file to get you started
-- You can modify this or create new migrations as needed

-- Example: Create a users table
-- CREATE TABLE IF NOT EXISTS public.users (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     email TEXT UNIQUE NOT NULL,
--     full_name TEXT,
--     avatar_url TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Example: Create a profiles table
-- CREATE TABLE IF NOT EXISTS public.profiles (
--     id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
--     username TEXT UNIQUE,
--     bio TEXT,
--     website TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Example: Enable Row Level Security
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Example: Create RLS policies
-- CREATE POLICY "Users can view their own profile" ON public.users
--     FOR SELECT USING (auth.uid() = id);

-- CREATE POLICY "Users can update their own profile" ON public.users
--     FOR UPDATE USING (auth.uid() = id);

-- CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
--     FOR SELECT USING (true);

-- CREATE POLICY "Users can update own profile" ON public.profiles
--     FOR UPDATE USING (auth.uid() = id);

-- Example: Create indexes
-- CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
-- CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Note: Uncomment and modify the above examples as needed for your project
-- Remember to enable RLS on all tables and create appropriate policies
