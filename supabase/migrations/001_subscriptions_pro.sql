-- Run this in Supabase Dashboard → SQL Editor
-- Adds Pro subscription columns to the subscriptions table

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan                     TEXT    DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW();

-- Make sure status column exists with a default
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free';

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
