// Supabase Edge Function: create-razorpay-sub
// Creates a Razorpay subscription and returns subscription_id to the frontend.
// Deploy: supabase functions deploy create-razorpay-sub

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RAZORPAY_KEY_ID     = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!
const PLAN_ID             = 'plan_T1VhAsoe182MWp'

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type'                : 'application/json',
}

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { user_id, email } = await req.json()
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'user_id and email are required' }), { status: 400, headers: CORS })
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    const rzpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        plan_id    : PLAN_ID,
        total_count: 120,   // up to 10 years — effectively unlimited recurring
        quantity   : 1,
        notes      : { user_id, email },
      }),
    })

    const sub = await rzpRes.json()

    if (!rzpRes.ok || !sub.id) {
      console.error('Razorpay error:', sub)
      return new Response(JSON.stringify({ error: sub.error?.description || 'Razorpay error' }), { status: 500, headers: CORS })
    }

    return new Response(JSON.stringify({ subscription_id: sub.id }), { headers: CORS })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: CORS })
  }
})
