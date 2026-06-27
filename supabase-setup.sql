-- ============================================================
-- FINOSUTRA — Supabase Database Setup
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ============================================================
-- TABLE 1: subscriptions
-- Stores each user's subscription status and validity period
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan                    TEXT NOT NULL DEFAULT 'pro',        -- 'pro' or 'team'
  status                  TEXT NOT NULL DEFAULT 'active',     -- 'active', 'cancelled', 'expired', 'past_due'
  razorpay_subscription_id TEXT,                              -- filled when Razorpay subscription is created
  razorpay_payment_id     TEXT,                              -- last successful payment ID
  current_period_start    TIMESTAMPTZ DEFAULT NOW(),
  current_period_end      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read ONLY their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (backend webhook) can create/update subscriptions
-- Regular users cannot give themselves Pro access
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- TABLE 2: leases
-- Stores saved lease calculations (Pro portfolio feature)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leases (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL DEFAULT 'Untitled Lease',
  client_name  TEXT,
  tool         TEXT NOT NULL DEFAULT 'indas116',   -- 'indas116', 'security_deposit', etc.
  inputs       JSONB,                               -- all form inputs saved as JSON
  results      JSONB,                               -- calculation results saved as JSON
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Users can only see, create, edit, delete their own leases
CREATE POLICY "Users can view own leases"
  ON public.leases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leases"
  ON public.leases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leases"
  ON public.leases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leases"
  ON public.leases FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- HELPER: auto-update updated_at on any row change
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_subscription_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_lease_updated
  BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================
-- DONE. Two tables created:
--   public.subscriptions  — subscription status per user
--   public.leases         — saved lease portfolio per user
-- ============================================================
