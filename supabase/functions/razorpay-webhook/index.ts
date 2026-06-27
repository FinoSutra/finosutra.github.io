// Supabase Edge Function: razorpay-webhook
// Receives Razorpay subscription events and updates the subscriptions table.
// Deploy: supabase functions deploy razorpay-webhook
// Register URL in Razorpay Dashboard → Settings → Webhooks

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET        = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const body      = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  // ── Verify HMAC-SHA256 signature ──
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBytes  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected  = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

  if (signature !== expected) {
    console.warn('Invalid signature')
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(body)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const subEntity = event?.payload?.subscription?.entity
  if (!subEntity) return new Response('OK', { status: 200 })

  const user_id  = subEntity.notes?.user_id
  const sub_id   = subEntity.id

  // ── subscription.activated / subscription.charged → activate Pro ──
  if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
    const period_end = new Date()
    period_end.setDate(period_end.getDate() + 30)

    const { error } = await supabase.from('subscriptions').upsert({
      user_id,
      status                  : 'active',
      plan                    : 'pro',
      razorpay_subscription_id: sub_id,
      current_period_end      : period_end.toISOString(),
      updated_at              : new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (error) console.error('Supabase upsert error:', error)
    else console.log(`Activated Pro for user ${user_id} until ${period_end.toISOString()}`)
  }

  // ── subscription.cancelled / subscription.halted → downgrade to free ──
  if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted') {
    const { error } = await supabase.from('subscriptions').upsert({
      user_id,
      status                  : 'cancelled',
      plan                    : 'free',
      razorpay_subscription_id: sub_id,
      updated_at              : new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (error) console.error('Supabase update error:', error)
    else console.log(`Cancelled Pro for user ${user_id}`)
  }

  return new Response('OK', { status: 200 })
})
