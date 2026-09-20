import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { publicStorageUrl } from '@/lib/storage-public-url'

const requestSchema = z.object({ path: z.string().min(1).max(500), download: z.boolean().optional() }).strict()
/** One-minute signed access; Storage RLS evaluates both level and resource access. */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input', message: 'A valid asset path is required.' }, { status: 400 })
  const client = await createClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'not_authenticated', message: 'Sign in to access course files.' }, { status: 401 })
  const bucket = client.storage.from('course-assets')
  const { data, error } = parsed.data.download
    ? await bucket.createSignedUrl(parsed.data.path, 60, { download: true })
    : await bucket.createSignedUrl(parsed.data.path, 60)
  // Same response for unknown and inaccessible paths prevents resource enumeration.
  if (error || !data) return NextResponse.json({ error: 'not_authorized', message: 'This course file is not available to you.' }, { status: 403 })
  return NextResponse.json({ url: publicStorageUrl(data.signedUrl), expiresIn: 60 }, { headers: { 'Cache-Control': 'private, no-store' } })
}
