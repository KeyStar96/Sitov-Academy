import { redirect } from 'next/navigation'
import { learningVideoDestination } from '@/lib/learning-video-redirect'

/** Resolve protected legacy links before rendering a streaming dashboard. */
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string; level: string; id: string }> }) {
  const { lang, level, id } = await params
  if (!['en', 'ru', 'uk', 'tr'].includes(lang)) return new Response(null, { status: 404 })
  redirect(await learningVideoDestination(lang, level, id))
}
