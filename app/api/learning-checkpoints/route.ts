import { NextResponse } from 'next/server'
import { z } from 'zod'
import { saveLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import { sitovCheckpointTarget } from '@/lib/learning-checkpoints'

const input = sitovCheckpointTarget.extend({ kind: z.enum(['videos', 'pronunciation']), state: z.record(z.string(), z.unknown()), revision: z.number().int().nonnegative(), learnerId: z.string().uuid() }).strict()

/** Small authenticated keepalive writes let a paused/closing player save. */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403 })
  const body = await request.text()
  if (new TextEncoder().encode(body).length > 265000) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 413 })
  const parsed = input.safeParse(await Promise.resolve().then(() => JSON.parse(body)).catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  const { kind, level, state, revision, learnerId } = parsed.data
  const result = await saveLearningCheckpoint(kind, level, state, revision, learnerId)
  return NextResponse.json(result, { status: result.ok === true ? 200 : result.error === 'conflict' ? 409 : result.error === 'unauthorized' ? 403 : 503, headers: { 'Cache-Control': 'private, no-store' } })
}
