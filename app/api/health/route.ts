import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readSupabaseServerConfig } from '@/lib/supabase-env'
import type { Database } from '@/supabase/database.types'

export const dynamic = 'force-dynamic'

/** Readiness reports no credentials, row contents or infrastructure addresses. */
export async function GET() {
  try {
    const { url, anonKey } = readSupabaseServerConfig()
    const client = createClient<Database>(url, anonKey, { auth: { persistSession:false, autoRefreshToken:false } })
    const { error } = await client.from('courses').select('id').is('archived_at',null).limit(1).abortSignal(AbortSignal.timeout(3000))
    if (error) throw new Error('database_unavailable')
    return NextResponse.json({ status:'ready' }, { headers:{ 'Cache-Control':'no-store' } })
  } catch {
    return NextResponse.json({ status:'unavailable' }, { status:503, headers:{ 'Cache-Control':'no-store' } })
  }
}
