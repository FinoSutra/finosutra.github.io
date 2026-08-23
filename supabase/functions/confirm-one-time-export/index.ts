// ================================================================================
// FINOSUTRA - Supabase Edge Function: confirm-one-time-export
//
// PURPOSE:
//   After a Rs79 one-time-export payment succeeds client-side, the frontend
//   fires a non-blocking call here with just the payment_id. This function:
//     1. Verifies the payment with Razorpay (never trusts the client's claim)
//     2. CAPTURES it if still only "authorized" - see the capture note below,
//        this is the actual bug this function exists to fix
//     3. Records it in one_time_purchases (service role, bypasses RLS)
//     4. Emails an owner sale-alert to billing@finosutra.com, and a receipt
//        to the customer if Razorpay captured an email/contact for them
//
//   No login required - anonymous purchases must be able to call this, so
//   this function's "Verify JWT" setting must be OFF in the Supabase
//   dashboard (Functions -> confirm-one-time-export -> Settings), unlike
//   confirm-subscription which requires a logged-in user.
//
// CAPTURE: checkout is opened with a bare amount and no order_id (same as
//   confirm-subscription's Pro checkout), so Razorpay's dashboard "Automatic
//   Capture" setting does NOT apply. Before this function existed, Rs79
//   payments were captured by NOTHING and would silently auto-void (money
//   returned to payer) after ~5 days. Do not remove the capture step.
//
// HOW TO DEPLOY (no CLI needed):
//   1. Go to: https://supabase.com/dashboard/project/uymuivmktvtxmodblxie/functions
//   2. Create a new function named "confirm-one-time-export"
//   3. Paste this entire file and click "Deploy"
//   4. In this function's Settings, turn OFF "Verify JWT" (anonymous buyers
//      must be able to call it)
//   5. Secrets required (Settings -> Edge Functions -> Secrets) - reuses the
//      same ones confirm-subscription already has:
//        RAZORPAY_KEY_ID     = rzp_live_TOZmt4wlnvNqYc
//        RAZORPAY_KEY_SECRET = (already configured)
//      Plus one new secret:
//        RESEND_API_KEY      = (from resend.com, after finosutra.com's
//                                sending domain is verified there)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ================================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const OWNER_EMAIL = "billing@finosutra.com"
const FROM_EMAIL  = "Finosutra <billing@finosutra.com>"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
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
      return jsonResponse(400, { error: "Payment not found at Razorpay (" + rzpRes.status + ")" })
    }

    const payment = await rzpRes.json()

    const amount = payment.amount as number
    if (amount !== 7900 || payment.currency !== "INR") {
      return jsonResponse(400, {
        error: "Payment amount/currency does not match the one-time export price (got Rs" + (amount / 100).toFixed(0) + " " + payment.currency + ")"
      })
    }

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

    const customerEmail = (payment.email as string) || null
    const customerContact = (payment.contact as string) || null

    const existingRes = await adminClient
      .from("one_time_purchases")
      .select("id")
      .eq("razorpay_payment_id", payment_id)
      .maybeSingle()

    if (existingRes.data) {
      return jsonResponse(200, { success: true, message: "Already recorded" })
    }

    const insertRes = await adminClient
      .from("one_time_purchases")
      .insert({
        razorpay_payment_id: payment_id,
        email: customerEmail,
        contact: customerContact,
        amount: amount,
        page: (payment.notes && payment.notes.page) || null,
      })

    if (insertRes.error) {
      console.error("one_time_purchases insert error: " + JSON.stringify(insertRes.error))
    }

    console.log("One-time export payment " + payment_id + " captured for Rs" + (amount / 100).toFixed(0))

    const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    const page = (payment.notes && payment.notes.page) || "unknown page"
    const amountRupees = (amount / 100).toFixed(0)

    const ownerHtml = "<p>A one-time Excel export was purchased.</p><ul>" +
      "<li><strong>Amount:</strong> Rs" + amountRupees + "</li>" +
      "<li><strong>Payment ID:</strong> " + payment_id + "</li>" +
      "<li><strong>Page:</strong> " + page + "</li>" +
      "<li><strong>Customer email:</strong> " + (customerEmail || "(not captured)") + "</li>" +
      "<li><strong>Customer contact:</strong> " + (customerContact || "(not captured)") + "</li>" +
      "<li><strong>When:</strong> " + when + " IST</li></ul>"

    await sendEmail(OWNER_EMAIL, "New sale: Rs" + amountRupees + " one-time export", ownerHtml)

    if (customerEmail) {
      const receiptHtml = "<p>Thanks for your purchase!</p><ul>" +
        "<li><strong>Amount paid:</strong> Rs" + amountRupees + "</li>" +
        "<li><strong>Payment ID:</strong> " + payment_id + "</li>" +
        "<li><strong>Date:</strong> " + when + " IST</li></ul>" +
        "<p>If you have any questions, reply to this email or write to billing@finosutra.com.</p>"

      await sendEmail(customerEmail, "Your Finosutra receipt - Excel export", receiptHtml)
    }

    return jsonResponse(200, { success: true })

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
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: subject, html: html }),
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
