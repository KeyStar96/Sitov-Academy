import { NextResponse } from 'next/server'
import { stripe } from '@/utils/stripe/server'
import { createClient } from '@/utils/supabase/server'
import { buildSiteUrl, getSiteUrl } from '@/lib/site-url'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Online payments are not configured' }, { status: 503 })
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return new NextResponse('Kein Stripe Kunde gefunden', { status: 400 })
    }

    const siteUrl = await getSiteUrl()
    const lang = req.headers.get('referer')?.includes('/tr/') ? 'tr' : req.headers.get('referer')?.includes('/ru/') ? 'ru' : 'de'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: buildSiteUrl(siteUrl, `/${lang}/dashboard/profile`),
      locale: 'de',
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
