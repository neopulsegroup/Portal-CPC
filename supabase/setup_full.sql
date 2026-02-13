-- 1. Base Schema and Functions (from 20251202140058)
-- Create enum types for the platform
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('migrant', 'company', 'mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.legal_status AS ENUM ('regularized', 'pending', 'not_regularized', 'refugee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.work_status AS ENUM ('employed', 'unemployed_seeking', 'unemployed_not_seeking', 'student', 'self_employed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.housing_status AS ENUM ('stable', 'temporary', 'precarious', 'homeless');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.language_level AS ENUM ('native', 'advanced', 'intermediate', 'basic', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.session_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('active', 'paused', 'closed', 'pending_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.application_status AS ENUM ('submitted', 'viewed', 'interview', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Profiles table for all users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'migrant',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Triage data for migrants
CREATE TABLE IF NOT EXISTS public.triage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  legal_status legal_status,
  work_status work_status,
  housing_status housing_status,
  language_level language_level,
  interests TEXT[] DEFAULT '{}',
  urgencies TEXT[] DEFAULT '{}',
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Company profiles with additional business info
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  nif TEXT,
  sector TEXT,
  description TEXT,
  location TEXT,
  website TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Sessions/appointments
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migrant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL, -- 'mediacao', 'juridico', 'psicologico'
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status session_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Learning trails
CREATE TABLE IF NOT EXISTS public.trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'trabalho', 'saude', 'direitos', 'cultura', 'empreendedorismo'
  modules_count INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'beginner',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trail modules/content
CREATE TABLE IF NOT EXISTS public.trail_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'video', 'text', 'pdf', 'quiz'
  content_url TEXT,
  content_text TEXT,
  order_index INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User trail progress
CREATE TABLE IF NOT EXISTS public.user_trail_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trail_id UUID REFERENCES public.trails(id) ON DELETE CASCADE NOT NULL,
  modules_completed INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, trail_id)
);

-- Job offers
CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  location TEXT,
  salary_range TEXT,
  contract_type TEXT,
  sector TEXT,
  status job_status DEFAULT 'pending_review',
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Job applications
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status application_status DEFAULT 'submitted',
  cover_letter TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(job_id, applicant_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trail_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Helper function to check for CPC staff role without recursion
CREATE OR REPLACE FUNCTION public.is_cpc_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role IN ('mediator', 'lawyer', 'psychologist', 'manager', 'coordinator', 'admin')
  );
END;
$$;

-- CPC team can view all profiles
DROP POLICY IF EXISTS "CPC can view all profiles" ON public.profiles;
CREATE POLICY "CPC can view all profiles" ON public.profiles FOR SELECT USING (
  is_cpc_staff()
);

-- Triage policies
DROP POLICY IF EXISTS "Users can view their own triage" ON public.triage;
CREATE POLICY "Users can view their own triage" ON public.triage FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own triage" ON public.triage;
CREATE POLICY "Users can insert their own triage" ON public.triage FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own triage" ON public.triage;
CREATE POLICY "Users can update their own triage" ON public.triage FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "CPC can view all triage" ON public.triage;
CREATE POLICY "CPC can view all triage" ON public.triage FOR SELECT USING (
  is_cpc_staff()
);

-- Companies policies
DROP POLICY IF EXISTS "Companies can view their own profile" ON public.companies;
CREATE POLICY "Companies can view their own profile" ON public.companies FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies can insert their own profile" ON public.companies;
CREATE POLICY "Companies can insert their own profile" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies can update their own profile" ON public.companies;
CREATE POLICY "Companies can update their own profile" ON public.companies FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view verified companies" ON public.companies;
CREATE POLICY "Anyone can view verified companies" ON public.companies FOR SELECT USING (verified = true);

-- Sessions policies
DROP POLICY IF EXISTS "Users can view their sessions" ON public.sessions;
CREATE POLICY "Users can view their sessions" ON public.sessions FOR SELECT USING (auth.uid() = migrant_id OR auth.uid() = professional_id);

DROP POLICY IF EXISTS "Users can create sessions" ON public.sessions;
CREATE POLICY "Users can create sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = migrant_id);

DROP POLICY IF EXISTS "CPC can view all sessions" ON public.sessions;
CREATE POLICY "CPC can view all sessions" ON public.sessions FOR SELECT USING (
  is_cpc_staff()
);

DROP POLICY IF EXISTS "CPC can update sessions" ON public.sessions;
CREATE POLICY "CPC can update sessions" ON public.sessions FOR UPDATE USING (
  is_cpc_staff()
);

-- Trails policies
DROP POLICY IF EXISTS "Anyone can view active trails" ON public.trails;
CREATE POLICY "Anyone can view active trails" ON public.trails FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "CPC can manage trails" ON public.trails;
CREATE POLICY "CPC can manage trails" ON public.trails FOR ALL USING (
  is_cpc_staff()
);

-- Trail modules policies
DROP POLICY IF EXISTS "Anyone can view trail modules" ON public.trail_modules;
CREATE POLICY "Anyone can view trail modules" ON public.trail_modules FOR SELECT USING (true);

DROP POLICY IF EXISTS "CPC can manage trail modules" ON public.trail_modules;
CREATE POLICY "CPC can manage trail modules" ON public.trail_modules FOR ALL USING (
  is_cpc_staff()
);

-- User progress policies
DROP POLICY IF EXISTS "Users can view their progress" ON public.user_trail_progress;
CREATE POLICY "Users can view their progress" ON public.user_trail_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their progress" ON public.user_trail_progress;
CREATE POLICY "Users can manage their progress" ON public.user_trail_progress FOR ALL USING (auth.uid() = user_id);

-- Job offers policies
DROP POLICY IF EXISTS "Anyone can view active jobs" ON public.job_offers;
CREATE POLICY "Anyone can view active jobs" ON public.job_offers FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Companies can manage their jobs" ON public.job_offers;
CREATE POLICY "Companies can manage their jobs" ON public.job_offers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS "CPC can manage all jobs" ON public.job_offers;
CREATE POLICY "CPC can manage all jobs" ON public.job_offers FOR ALL USING (
  is_cpc_staff()
);

-- Job applications policies
DROP POLICY IF EXISTS "Users can view their applications" ON public.job_applications;
CREATE POLICY "Users can view their applications" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Users can create applications" ON public.job_applications;
CREATE POLICY "Users can create applications" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Companies can view applications for their jobs" ON public.job_applications;
CREATE POLICY "Companies can view applications for their jobs" ON public.job_applications FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.job_offers j 
    JOIN public.companies c ON j.company_id = c.id 
    WHERE j.id = job_id AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Companies can update applications for their jobs" ON public.job_applications;
CREATE POLICY "Companies can update applications for their jobs" ON public.job_applications FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.job_offers j 
    JOIN public.companies c ON j.company_id = c.id 
    WHERE j.id = job_id AND c.user_id = auth.uid()
  )
);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'migrant')
  );
  
  -- Create triage record for migrants
  IF (NEW.raw_user_meta_data ->> 'role') = 'migrant' OR (NEW.raw_user_meta_data ->> 'role') IS NULL THEN
    INSERT INTO public.triage (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp (includes fix from 20251202140110)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_triage_updated_at ON public.triage;
CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON public.triage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_trails_updated_at ON public.trails;
CREATE TRIGGER update_trails_updated_at BEFORE UPDATE ON public.trails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_offers_updated_at ON public.job_offers;
CREATE TRIGGER update_job_offers_updated_at BEFORE UPDATE ON public.job_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Add Triage Answers (from 20240523000000)
ALTER TABLE public.triage 
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.triage.answers IS 'Stores detailed questionnaire responses from the triage form.';
