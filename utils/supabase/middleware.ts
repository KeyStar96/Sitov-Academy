import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/supabase/database.types'
import { readSupabaseServerConfig, SUPABASE_COOKIE_NAME } from '@/lib/supabase-env'

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

  return { supabaseResponse, user }
}
