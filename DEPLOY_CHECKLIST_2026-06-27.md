# Deploy + Test Checklist — 2026-06-27 Bug Fixes

## 1. Run the database fix FIRST (this unlocks everything else)

This is the root cause of every "I'm a Pro subscriber but it still charges me ₹99/₹499" complaint in the ISSUES docx, across IND AS116 Standard, IND AS116 Model 2, and Security Deposit.

1. Go to Supabase Dashboard → your Finosutra project → SQL Editor → New query.
2. Open `supabase/migrations/002_fix_subscriptions_unique_constraint.sql` in this folder, copy all of it, paste into the SQL Editor.
3. Click Run. You should see no errors (a "NOTICE" message is fine if you run it twice).

What this fixes: the webhook that marks a user as "Pro" after payment was silently failing to save because the database was missing a required constraint. No frontend code can fix this — it had to be the database.

## 2. Files changed — commit and push these 6 files

| File | What changed |
|---|---|
| `indas116-model2.html` | Export button now self-heals if ad-blocker blocks the payment script |
| `security-deposit.html` | Same fix |
| `templates.html` | Same fix |
| `pro-subscription.js` | Same fix, for the shared ₹499 Pro button (used on 4 pages) |
| `india-tax-calculator.html` | Same fix on the ₹99 Excel export button **+** fixed the Recalculate button (was a silent no-op — now sends you back to edit inputs with a confirmation message) |
| `indas116.html` | Same fix on the ₹499 Pro button (was the only tool still missing it) |

Push these to GitHub as usual — your auto-deploy pipeline will pick them up.

## 3. Test after deploy (5 minutes)

**Export buttons (logged out / free user):**
- Open each tool, enter any numbers, click Calculate, click the ₹99/₹499 export button. It should open Razorpay normally. (The fix only changes behavior when an ad-blocker is active — most testing will look unchanged.)
- To actually test the fix: enable an ad-blocker (uBlock Origin, Brave Shield, etc.) and click export again. You should now see a "Loading payment…" toast, then either Razorpay opens anyway or you get a clear message about disabling the ad-blocker — not the old generic "check your connection" error.

**Recalculate (Income Tax Calculator only):**
- Calculate your tax, scroll to the result page, click "↻ Recalculate." You should see a toast and land back on Personal Info — not a silent re-render of the same numbers.

**Pro subscriber flow (the important one):**
1. Log in as your test Pro account (`ca.krishnawadekar07@gmail.com`).
2. In Supabase Table Editor, check the `subscriptions` table — confirm there's exactly one row for this user, `status = active`, `current_period_end` in the future.
3. Visit IND AS116, IND AS116 Model 2, Security Deposit, and Income Tax Calculator. The ₹99/₹499 buttons should be hidden or replaced with a free-download action — not a payment prompt.
4. If you still see a payment prompt after step 1's migration ran successfully, that's a new bug — come back and we'll dig in.

## Notes
- I can't run the SQL migration myself — no database credentials in this sandbox. Step 1 has to be you.
- Everything else above is already written and saved in your project folder; nothing further needed from me until you've deployed and tested.
