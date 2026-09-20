import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/supabase/database.types'
import { readSupabaseServerConfig, SUPABASE_COOKIE_NAME } from '@/lib/supabase-env'
import { LOCALES, type UiLocale } from '@/lib/locale-routing'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url, anonKey } = readSupabaseServerConfig()
  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookieOptions: { name: SUPABASE_COOKIE_NAME, secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          const previousCookies = supabaseResponse.cookies.getAll()
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          previousCookies.forEach(cookie => supabaseResponse.cookies.set(cookie))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // refreshes session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { user } } = await supabase.auth.getUser()

  // Navigation follows the saved preference, including entry from marketing.
  // Do not redirect POST actions before they can save a new language.
  let uiLanguage: UiLocale | null = null
  if (user && (request.method === 'GET' || request.method === 'HEAD')) {
    const { data: profile, error } = await supabase.from('profiles')
      .select('ui_language').eq('id', user.id).maybeSingle()
    if (error) throw new Error('Interface language could not be loaded')
    uiLanguage = LOCALES.find(locale => locale === profile?.ui_language) ?? null
  }
  if (user) supabaseResponse.headers.set('Cache-Control', 'private, no-store')

  return { supabaseResponse, user, uiLanguage }
}
