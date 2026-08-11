// ═══════════════════════════════════════════════════════════════════════════════
// FINOSUTRA — Supabase Edge Function: confirm-subscription
//
// PURPOSE:
//   After a user pays via Razorpay, the frontend calls this function.
//   It verifies the payment is real (via Razorpay API), then inserts a
//   subscription row in the database using the service role key (bypasses RLS).
//
//   Supported plans:
//     pro         ₹499  (49900 paise) → 30 days
//     pro_annual  ₹3,999 (399900 paise) → 365 days
//
// CAPTURE: checkout is opened with a bare amount and no order_id, so Razorpay's
//   dashboard "Automatic Capture" setting does NOT apply — it only governs
//   payments created via the Orders API. Payments therefore arrive as
//   "authorized" and this function captures them explicitly (Step 5b). Do not
//   remove that step expecting the dashboard toggle to cover it; the money will
//   silently auto-void after ~5 days and no subscription will ever activate.
//
// HOW TO DEPLOY (no CLI needed):
//   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
//   2. Click confirm-subscription → Code tab → Edit
//   3. Paste this entire file and click "Deploy"
//   4. Secrets required (Settings → Edge Functions → Secrets):
//      RAZORPAY_KEY_ID     = rzp_live_TOZmt4wlnvNqYc
//      RAZORPAY_KEY_SECRET = (secret paired with the key ID above — never commit it)
//
//   RAZORPAY_KEY_ID here MUST match RZP_KEY in auth.js. They are one account's
//   key pair; if they drift, every payment is captured but verification fails
//   and the subscriptions row is never written.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are
// injected automatically — you do NOT need to add them manually.
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
    // ── Step 1: Authenticate the user ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "No authorization header" })
    }

    // Use anon client with user's JWT to get their identity
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse(401, { error: "Invalid or expired session. Please log in again." })
    }

    // ── Step 2: Parse request body ────────────────────────────────────────────
    let body: { payment_id?: string }
    try {
      body = await req.json()
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" })
    }

    const { payment_id } = body
    if (!payment_id || typeof payment_id !== "string") {
      return jsonResponse(400, { error: "payment_id is required" })
    }

    // ── Step 3: Verify payment with Razorpay API ──────────────────────────────
    const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID") ?? ""
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? ""

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials not configured in Edge Function secrets")
      return jsonResponse(500, { error: "Payment gateway not configured" })
    }

    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      }
    })

    if (!rzpRes.ok) {
      // Surface the status so bad credentials (401/403) are distinguishable from
      // an unknown payment id (400/404). Collapsing both into one message made a
      // key-rotation outage look identical to a typo'd payment id.
      console.error(`Razorpay GET payment failed: ${rzpRes.status}`)
      const hint = (rzpRes.status === 401 || rzpRes.status === 403)
        ? "Payment gateway credentials rejected — check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
        : "Payment not found at Razorpay."
      return jsonResponse(400, { error: `${hint} (Razorpay ${rzpRes.status})` })
    }

    const payment = await rzpRes.json()

    // ── Step 4: Confirm the payment belongs to this user ─────────────────────
    // The frontend stamps notes.user_id at checkout. When present it must match
    // the caller, otherwise any logged-in user could claim someone else's
    // unclaimed payment id.
    const notesUserId = payment.notes && payment.notes.user_id
    if (notesUserId && notesUserId !== user.id) {
      console.error(`Payment ${payment_id} belongs to ${notesUserId}, claimed by ${user.id}`)
      return jsonResponse(403, { error: "This payment belongs to a different account." })
    }

    // ── Step 5: Determine plan from payment amount ────────────────────────────
    // Annual plan: ₹3,999 (399900 paise) → 365 days
    // Monthly plan: ₹499  (49900 paise)  → 30 days
    // Reject anything below ₹498 (not a valid Pro payment)
    // Checked BEFORE capture — never capture money for an amount we would then
    // refuse to honour.
    const amount = payment.amount as number

    if (!amount || amount < 49800) {
      return jsonResponse(400, {
        error: `Payment amount ₹${(amount / 100).toFixed(0)} does not match any Pro plan price`
      })
    }

    const isAnnual  = amount >= 399800   // ₹3,999 annual plan
    const planName  = isAnnual ? "pro_annual" : "pro"
    const daysToAdd = isAnnual ? 365 : 30

    // ── Step 5b: Capture the payment if it is only authorised ────────────────
    // Razorpay's dashboard "Automatic Capture" setting applies ONLY to payments
    // created through the Orders API. Checkout here is opened with a bare
    // amount and no order_id, so payments land as "authorized" and would expire
    // (auto-void) after ~5 days without ever activating Pro. Capture explicitly
    // rather than depending on an account setting that cannot apply.
    let paymentStatus = payment.status

    if (paymentStatus === "authorized") {
      const capRes = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}/capture`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount, currency: payment.currency || "INR" })
      })

      if (!capRes.ok) {
        const detail = await capRes.text()
        console.error(`Razorpay capture failed: ${capRes.status} ${detail}`)
        return jsonResponse(400, {
          error: `Could not capture payment (Razorpay ${capRes.status}). Payment ID: ${payment_id}`
        })
      }

      const captured = await capRes.json()
      paymentStatus = captured.status
      console.log(`✓ Captured ${payment_id} for ₹${(amount / 100).toFixed(0)}`)
    }

    if (paymentStatus !== "captured") {
      return jsonResponse(400, {
        error: `Payment not captured (status: ${paymentStatus}). Contact support with payment ID: ${payment_id}`
      })
    }

    // ── Step 6: Check for duplicate (idempotency) ─────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { data: existing } = await adminClient
      .from("subscriptions")
      .select("id, current_period_end")
      .eq("razorpay_payment_id", payment_id)
      .maybeSingle()

    if (existing) {
      // Already processed — return success with existing period end
      return jsonResponse(200, {
        success: true,
        period_end: existing.current_period_end,
        message: "Subscription already active"
      })
    }

    // ── Step 7: Insert subscription row ──────────────────────────────────────
    const now       = new Date()
    const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    const { error: insertError } = await adminClient
      .from("subscriptions")
      .insert({
        user_id:              user.id,
        plan:                 planName,
        status:               "active",
        razorpay_payment_id:  payment_id,
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
      })

    if (insertError) {
      console.error("Subscription insert error:", insertError)
      return jsonResponse(500, { error: "Database error. Contact support with payment ID: " + payment_id })
    }

    console.log(`✓ ${planName} activated for user ${user.id}, payment ${payment_id}, expires ${periodEnd.toISOString()} (+${daysToAdd} days)`)

    return jsonResponse(200, {
      success:    true,
      period_end: periodEnd.toISOString(),
      message:    `Pro subscription activated for ${daysToAdd} days`
    })

  } catch (e) {
    console.error("Unhandled error:", e)
    return jsonResponse(500, { error: "Internal server error" })
  }
})

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}
