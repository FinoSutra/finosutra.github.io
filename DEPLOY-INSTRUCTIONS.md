# Finosutra — Deploy Instructions
## Two things to do to go live with Pro subscriptions

---

## STEP 1: Deploy the Edge Function (10 minutes)

This is the secure backend that verifies payments and activates Pro.

### 1a. Get your Razorpay Secret Key
1. Go to: https://dashboard.razorpay.com/app/website-app-settings/api-keys
2. You will see your **Key ID** (`rzp_live_Sty2e9lT4uXzJJ`) and a **Key Secret**
3. **Copy the Key Secret** — it looks like `rzp_live_XXXXXXXXXXXXXXXXX` (but longer)
4. Keep it secret — never put it in any HTML file

### 1b. Create the Edge Function in Supabase
1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
2. Click **"Create a new function"**
3. Name it exactly: `confirm-subscription`
4. Open the file `confirm-subscription.ts` from your project folder
5. **Copy the entire contents** and paste it into the Supabase editor
6. Click **"Deploy"**

### 1c. Add the Secret Keys to the Edge Function
1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/settings/functions
2. Scroll down to **"Edge Function Secrets"**
3. Add these two secrets:

| Name | Value |
|------|-------|
| `RAZORPAY_KEY_ID` | `rzp_live_Sty2e9lT4uXzJJ` |
| `RAZORPAY_KEY_SECRET` | (the secret key you copied in step 1a) |

4. Click **Save**

> **Note:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do NOT add them manually.

### 1d. Test the Edge Function is deployed
1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
2. You should see `confirm-subscription` with status **Active**

---

## STEP 2: Upload all changed files to GitHub

### Files to upload (drag all of these at once):

**New file (must create):**
- `auth.js` — shared auth module for all paid tools

**Updated files:**
- `index.html` — Pro pricing, removed stale ₹399 early bird modal
- `indas116.html` — Supabase auth + Pro subscription gate (inline)
- `indas116-model2.html` — auth.js + FAQs + JSON-LD schema
- `security-deposit.html` — auth.js added
- `salary-calculator.html` — auth.js added
- `india-tax-calculator.html` — auth.js added
- `indas-tools.html` — auth.js added
- `income-tax-hub.html` — auth.js added
- `gst-tools.html` — auth.js added
- `salary-hr.html` — auth.js added
- `templates.html` — WhatsApp footer link fixed
- `emi-calculator.html` — GST nav link added
- `gratuity-calculator.html` — GST nav link added
- `gst-calculator.html` — GST nav link added
- `hra-calculator.html` — GST nav link added

### How to upload:
1. Go to: https://github.com/finosutra/finosutra.github.io
2. Click **"Add file → Upload files"**
3. Drag all the files listed above into the upload area
4. Commit message: `Auth + Pro subscription + site audit fixes`
5. Wait ~2 minutes for GitHub Pages to deploy

---

## STEP 3: Enable Email Auth in Supabase (if not already done)

1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/auth/providers
2. Make sure **Email** provider is **Enabled**
3. Under **Email Auth** settings:
   - **Confirm email**: ON (users must confirm email before logging in)
   - **Secure email change**: ON

---

## How the full flow works (once deployed)

```
User visits indas116.html
     ↓
Nav shows "Log In" button (Supabase session check takes ~200ms)
     ↓
User clicks "Log In" → Auth modal opens
     ↓
User signs up (gets confirmation email) → confirms → logs in
     ↓
If user has active Pro subscription → "PRO" badge in nav, Download is FREE
If user does NOT have Pro → Export card shows "Upgrade to Pro ₹499/mo" banner
     ↓
User clicks "Upgrade to Pro ₹499/mo"
     ↓
Razorpay payment window opens (₹499)
     ↓
Payment success → frontend calls Edge Function /confirm-subscription
     ↓
Edge Function verifies payment with Razorpay API → inserts row in subscriptions table
     ↓
"🎉 Pro activated!" toast + nav badge updates + export button shows FREE
     ↓
Next page load → subscription check returns Pro → free exports immediately
```

---

## Pricing reminder

| User Type | Cost | Export |
|-----------|------|--------|
| Not logged in | Free | ₹99 per Excel export |
| Logged in, no Pro | Free | ₹99 per Excel export + Pro upgrade banner shown |
| Logged in, Pro active | ₹499/month | Free unlimited exports |

---

## Troubleshooting

**"Payment not captured" error in edge function:**
→ This means the payment went through but Razorpay hasn't settled it yet. Rare. User should email fino.sutra07@gmail.com with payment ID — manually insert a row in the subscriptions table.

**User paid but Pro didn't activate:**
→ The activation error toast shows the payment ID. Manual fix:
```sql
-- Run in Supabase SQL Editor
INSERT INTO public.subscriptions (user_id, plan, status, razorpay_payment_id, current_period_start, current_period_end)
VALUES (
  '<user_id from auth.users table>',
  'pro', 'active', '<payment_id>',
  NOW(), NOW() + INTERVAL '30 days'
);
```

**Edge function returns 401:**
→ User's session expired. They need to log in again.

**Edge function not found (404):**
→ Function wasn't deployed. Redo Step 1b.
