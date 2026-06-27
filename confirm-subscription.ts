// ═══════════════════════════════════════════════════════════════════════════════
// FINOSUTRA — Supabase Edge Function: confirm-subscription
//
// PURPOSE:
//   After a user pays ₹499 via Razorpay, the frontend calls this function.
//   It verifies the payment is real (via Razorpay API), then inserts a
//   subscription row in the database using the service role key (bypasses RLS).
//
// HOW TO DEPLOY (no CLI needed):
//   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
//   2. Click "New Function"
//   3. Name it exactly: confirm-subscription
//   4. Paste this entire file into the editor
//   5. Click "Deploy"
//   6. Then go to Settings → Edge Functions → Secrets and add:
//      RAZORPAY_KEY_ID     = rzp_live_Sty2e9lT4uXzJJ
//      RAZORPAY_KEY_SECRET = (your Razorpay secret key — from Razorpay Dashboard → Settings → API Keys)
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
      console.error(`Razorpay API error: ${rzpRes.status}`)
      return jsonResponse(400, { error: "Could not verify payment with Razorpay" })
    }

    const payment = await rzpRes.json()

    // ── Step 4: Validate payment amount and status ────────────────────────────
    if (payment.status !== "captured") {
      return jsonResponse(400, {
        error: `Payment not captured (status: ${payment.status}). Contact support with payment ID.`
      })
    }

    // Accept ₹499 (49900 paise). Allow ₹498+ to handle any rounding edge cases.
    if (!payment.amount || payment.amount < 49800) {
      return jsonResponse(400, {
        error: `Payment amount ₹${(payment.amount / 100).toFixed(0)} does not match Pro plan price`
      })
    }

    // ── Step 5: Check for duplicate (idempotency) ─────────────────────────────
    // If this payment_id was already processed, return success without re-inserting
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

    // ── Step 6: Insert subscription row ──────────────────────────────────────
    const now       = new Date()
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // now + 30 days

    const { error: insertError } = await adminClient
      .from("subscriptions")
      .insert({
        user_id:              user.id,
        plan:                 "pro",
        status:               "active",
        razorpay_payment_id:  payment_id,
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
      })

    if (insertError) {
      console.error("Subscription insert error:", insertError)
      return jsonResponse(500, { error: "Database error. Contact support with payment ID: " + payment_id })
    }

    console.log(`✓ Pro activated for user ${user.id}, payment ${payment_id}, expires ${periodEnd.toISOString()}`)

    return jsonResponse(200, {
      success:    true,
      period_end: periodEnd.toISOString(),
      message:    "Pro subscription activated for 30 days"
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
