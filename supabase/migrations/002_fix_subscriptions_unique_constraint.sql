-- ============================================================
-- FIX: Pro subscribers not actually getting Pro access
-- ============================================================
-- Root cause: supabase/functions/razorpay-webhook/index.ts writes
-- Pro status using:
--     .upsert({...}, { onConflict: 'user_id' })
-- Postgres requires a UNIQUE (or primary key) constraint on the
-- column(s) named in onConflict, or the upsert fails. The original
-- supabase-setup.sql never added one — only `id` is unique.
--
-- Effect in production: the webhook's insert/update silently fails
-- every time (logged only to Supabase Edge Function console, which
-- nobody was watching), Razorpay still gets a 200 OK so it never
-- retries, and the subscriptions row confirming "this user paid" is
-- never written. checkProStatus() then correctly finds no active row
-- and shows the paywall again — exactly the bug in
-- "ISSUES/FREE and PRO plan issue in tools.docx" (Pro subscriber still
-- seeing 99/499 prompts on indas116.html, indas116-model2.html,
-- security-deposit.html, india-tax-calculator.html).
--
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Step 1: Safety dedupe.
-- If any user already has more than one subscriptions row (possible
-- leftover from manual testing), keep only the most recently updated
-- one so the UNIQUE constraint below can be added without erroring.
DELETE FROM public.subscriptions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM public.subscriptions
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add the missing UNIQUE constraint.
-- Wrapped so re-running this file is harmless if already applied.
DO $$
BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'subscriptions_user_id_key already exists — skipping.';
END $$;

-- ============================================================
-- DONE. After running this:
--   - razorpay-webhook's upsert(onConflict:'user_id') will succeed.
--   - Each user can only ever have ONE subscriptions row, which the
--     webhook updates in place on every renewal/cancellation — this
--     matches how checkProStatus()/fsCheckSubscription() already
--     query the table (looking for one active row per user).
-- ============================================================
