import { NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: 'Online payments are not configured' }, { status: 503 })
  }
  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return new NextResponse('Missing signature', { status: 400 })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new NextResponse('Invalid webhook signature', { status: 400 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const subscription = event.data.object as Stripe.Subscription

  try {
    // Only a verified event may create a privileged database client.
    const supabaseAdmin = createAdminClient()
    switch (event.type) {
      case 'checkout.session.completed':
        if (session.mode === 'subscription' && session.subscription && session.metadata?.supabase_user_id) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          // Read current state: webhooks may arrive late or in a different order.
          const current = await stripe.subscriptions.retrieve(subscriptionId)
          const customerId = typeof current.customer === 'string' ? current.customer : current.customer.id
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({
              subscription_status: current.status === 'active' || current.status === 'trialing' ? 'aktiv' : 'kostenlos',
              stripe_customer_id: customerId,
              stripe_subscription_id: current.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.metadata.supabase_user_id)
          if (error) throw error
        }
        break

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const { status } = await stripe.subscriptions.retrieve(subscription.id)
        const isActive = status === 'active' || status === 'trialing'
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: isActive ? 'aktiv' : 'kostenlos',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id)
        if (error) throw error
        break
      }
        
      default:
        console.log(`Unhandled event type ${event.type}`)
    }
  } catch (error) {
    console.error('Database update failed:', error)
    return new NextResponse('Database Update Failed', { status: 500 })
  }

  return new NextResponse('Webhook handled', { status: 200 })
}
