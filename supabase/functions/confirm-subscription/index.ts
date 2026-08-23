// ================================================================================
// FINOSUTRA - Supabase Edge Function: confirm-subscription
//
// PURPOSE:
//   After a user pays via Razorpay, the frontend calls this function.
//   It verifies the payment is real (via Razorpay API), then inserts a
//   subscription row in the database using the service role key (bypasses RLS).
//
//   Supported plans:
//     pro         Rs499  (49900 paise) -> 30 days
//     pro_annual  Rs3999 (399900 paise) -> 365 days
//
//   On a fresh (non-duplicate) activation, also emails a sale alert to
//   billing@finosutra.com and a receipt to the subscriber - see sendEmail()
//   near the bottom. Requires the RESEND_API_KEY secret (see below); if it's
//   missing, sendEmail() logs a warning and skips silently rather than
//   failing the subscription activation itself.
//
// CAPTURE: checkout is opened with a bare amount and no order_id, so Razorpay's
//   dashboard "Automatic Capture" setting does NOT apply - it only governs
//   payments created via the Orders API. Payments therefore arrive as
//   "authorized" and this function captures them explicitly (Step 5b). Do not
//   remove that step expecting the dashboard toggle to cover it; the money will
//   silently auto-void after ~5 days and no subscription will ever activate.
//
// HOW TO DEPLOY (no CLI needed):
//   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
//   2. Click confirm-subscription -> Code tab -> Edit
//   3. Paste this entire file and click "Deploy"
//   4. Secrets required (Settings -> Edge Functions -> Secrets):
//      RAZORPAY_KEY_ID     = rzp_live_TOZmt4wlnvNqYc
//      RAZORPAY_KEY_SECRET = (secret paired with the key ID above - never commit it)
//      RESEND_API_KEY      = (from resend.com, after finosutra.com's sending
//                             domain is verified there - shared with the
//                             confirm-one-time-export function)
//
//   RAZORPAY_KEY_ID here MUST match RZP_KEY in auth.js. They are one account's
//   key pair; if they drift, every payment is captured but verification fails
//   and the subscriptions row is never written.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are
// injected automatically - you do NOT need to add them manually.
// ================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "No authorization header" })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } }
    )

    const userRes = await supabase.auth.getUser()
    const user = userRes.data.user
    if (userRes.error || !user) {
      return jsonResponse(401, { error: "Invalid or expired session. Please log in again." })
    }

    let body: { payment_id?: string }
    try {
      body = await req.json()
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" })
    }

    const payment_id = body.payment_id
    if (!payment_id || typeof payment_id !== "string") {
      return jsonResponse(400, { error: "payment_id is required" })
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || ""
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || ""

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay credentials not configured in Edge Function secrets")
      return jsonResponse(500, { error: "Payment gateway not configured" })
    }

    const credentials = btoa(RAZORPAY_KEY_ID + ":" + RAZORPAY_KEY_SECRET)
    const rzpRes = await fetch("https://api.razorpay.com/v1/payments/" + payment_id, {
      headers: {
        "Authorization": "Basic " + credentials,
        "Content-Type": "application/json",
      }
    })

    if (!rzpRes.ok) {
      console.error("Razorpay GET payment failed: " + rzpRes.status)
      const hint = (rzpRes.status === 401 || rzpRes.status === 403)
        ? "Payment gateway credentials rejected - check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
        : "Payment not found at Razorpay."
      return jsonResponse(400, { error: hint + " (Razorpay " + rzpRes.status + ")" })
    }

    const payment = await rzpRes.json()

    const notesUserId = payment.notes && payment.notes.user_id
    if (notesUserId && notesUserId !== user.id) {
      console.error("Payment " + payment_id + " belongs to " + notesUserId + ", claimed by " + user.id)
      return jsonResponse(403, { error: "This payment belongs to a different account." })
    }

    const amount = payment.amount as number

    if (!amount || amount < 49800) {
      return jsonResponse(400, {
        error: "Payment amount Rs" + (amount / 100).toFixed(0) + " does not match any Pro plan price"
      })
    }

    const isAnnual = amount >= 399800
    const planName = isAnnual ? "pro_annual" : "pro"
    const daysToAdd = isAnnual ? 365 : 30

    let paymentStatus = payment.status

    if (paymentStatus === "authorized") {
      const capRes = await fetch("https://api.razorpay.com/v1/payments/" + payment_id + "/capture", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + credentials,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amount, currency: payment.currency || "INR" })
      })

      if (!capRes.ok) {
        const detail = await capRes.text()
        console.error("Razorpay capture failed: " + capRes.status + " " + detail)
        return jsonResponse(400, {
          error: "Could not capture payment (Razorpay " + capRes.status + "). Payment ID: " + payment_id
        })
      }

      const captured = await capRes.json()
      paymentStatus = captured.status
      console.log("Captured " + payment_id + " for Rs" + (amount / 100).toFixed(0))
    }

    if (paymentStatus !== "captured") {
      return jsonResponse(400, {
        error: "Payment not captured (status: " + paymentStatus + "). Contact support with payment ID: " + payment_id
      })
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    )

    const existingRes = await adminClient
      .from("subscriptions")
      .select("id, current_period_end")
      .eq("razorpay_payment_id", payment_id)
      .maybeSingle()

    if (existingRes.data) {
      return jsonResponse(200, {
        success: true,
        period_end: existingRes.data.current_period_end,
        message: "Subscription already active"
      })
    }

    const now = new Date()
    const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    const insertRes = await adminClient
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan: planName,
        status: "active",
        razorpay_payment_id: payment_id,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })

    if (insertRes.error) {
      console.error("Subscription insert error: " + JSON.stringify(insertRes.error))
      return jsonResponse(500, { error: "Database error. Contact support with payment ID: " + payment_id })
    }

    console.log(planName + " activated for user " + user.id + ", payment " + payment_id + ", expires " + periodEnd.toISOString() + " (+" + daysToAdd + " days)")

    const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    const planLabel = isAnnual ? "Annual Pro (Rs3999/yr)" : "Pro (Rs499/mo)"
    const expiryDate = periodEnd.toLocaleDateString("en-IN")

    const ownerHtml = "<p>A Pro subscription was purchased.</p><ul>" +
      "<li><strong>Plan:</strong> " + planLabel + "</li>" +
      "<li><strong>Payment ID:</strong> " + payment_id + "</li>" +
      "<li><strong>Subscriber email:</strong> " + user.email + "</li>" +
      "<li><strong>Expires:</strong> " + expiryDate + "</li>" +
      "<li><strong>When:</strong> " + when + " IST</li></ul>"

    await sendEmail("billing@finosutra.com", "New sale: " + planLabel + " subscription", ownerHtml)

    if (user.email) {
      const subscriberHtml = "<p>Thanks for subscribing to Finosutra Pro!</p><ul>" +
        "<li><strong>Plan:</strong> " + planLabel + "</li>" +
        "<li><strong>Payment ID:</strong> " + payment_id + "</li>" +
        "<li><strong>Active until:</strong> " + expiryDate + "</li></ul>" +
        "<p>Unlimited Excel exports across every tool until then. Questions? Reply to this email or write to billing@finosutra.com.</p>"

      await sendEmail(user.email, "Your Finosutra Pro subscription is active", subscriberHtml)
    }

    return jsonResponse(200, {
      success: true,
      period_end: periodEnd.toISOString(),
      message: "Pro subscription activated for " + daysToAdd + " days"
    })

  } catch (e) {
    console.error("Unhandled error: " + e)
    return jsonResponse(500, { error: "Internal server error" })
  }
})

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set - skipping email to " + to)
    return
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: "Finosutra <billing@finosutra.com>", to: [to], subject: subject, html: html }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error("Resend send to " + to + " failed: " + res.status + " " + text)
    }
  } catch (e) {
    console.error("Resend send to " + to + " threw: " + e)
  }
}

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  })
}
