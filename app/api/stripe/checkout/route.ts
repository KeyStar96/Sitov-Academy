import { NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { buildSiteUrl, getSiteUrl } from '@/lib/site-url'
import { toUiLocale } from '@/lib/locale-routing'

export async function POST(_req: Request) {
  const priceId = process.env.STRIPE_PRICE_ID?.trim()
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !priceId) return NextResponse.json({ error: 'Online payments are not configured' }, { status: 503 })
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profile_details')
      .select('stripe_customer_id, email, ui_language')
      .eq('id', user.id)
      .single()
    if (profileError || !profile?.email) throw new Error('Billing profile unavailable')

    const siteUrl = await getSiteUrl()
    const lang = toUiLocale(profile.ui_language)
    
    let stripeCustomerId = profile?.stripe_customer_id

    // Fallback: Create customer if it doesn't exist
    if (!stripeCustomerId && profile?.email) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: user.id
        }
      })
      stripeCustomerId = customer.id
      
      // Billing columns are not writable by the browser/cookie role.
      // The authenticated user's ID and Stripe's response are server-derived.
      const { error: profileUpdateError } = await createAdminClient()
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id)
        .select('id')
        .single()
      if (profileUpdateError) throw profileUpdateError
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId || undefined,
      customer_email: !stripeCustomerId ? profile?.email : undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: buildSiteUrl(siteUrl, `/${lang}/dashboard`, { payment: 'success' }),
      cancel_url: buildSiteUrl(siteUrl, `/${lang}/dashboard/profile`, { payment: 'cancelled' }),
      metadata: {
        supabase_user_id: user.id
      },
      locale: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
