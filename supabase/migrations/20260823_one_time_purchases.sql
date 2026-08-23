-- ═══════════════════════════════════════════════════════════════════════════════
-- FINOSUTRA — Durable record of ₹79 one-time export purchases
--
-- Written by the confirm-one-time-export Edge Function after it verifies and
-- captures the Razorpay payment. Gives the owner a queryable log of purchases
-- (visible directly in Supabase Table Editor even without opening email) and
-- doubles as the idempotency check so a retried/duplicated client call never
-- sends duplicate notification emails for the same payment.
--
-- No RLS policies are added on purpose — this table is only ever written to
-- and read from the Edge Function using the service-role key, never from the
-- browser client directly.
--
-- HOW TO DEPLOY:
--   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/sql/new
--   2. Paste this entire file and click "Run"
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.one_time_purchases (
  id                  uuid primary key default gen_random_uuid(),
  razorpay_payment_id text not null unique,
  email               text,
  contact             text,
  amount              int not null,
  page                text,
  created_at          timestamptz not null default now()
);

alter table public.one_time_purchases enable row level security;
-- No policies: only the service-role key (used exclusively inside the Edge
-- Function) can read or write this table; anon/authenticated get nothing.
