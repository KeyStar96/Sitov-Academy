import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/supabase/database.types'
import { readSupabaseServerConfig, SUPABASE_COOKIE_NAME } from '@/lib/supabase-env'

export async function createClient() {
    const cookieStore = await cookies()
    const { url, anonKey } = readSupabaseServerConfig()

    return createServerClient<Database>(
        url,
        anonKey,
        {
            cookieOptions: { name: SUPABASE_COOKIE_NAME, secure: process.env.NODE_ENV === 'production' },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}
