import { notFound } from 'next/navigation'

/** Same-origin device frame for visual QA; unavailable in production. */
export default async function SitovResponsivePreview({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ view?: string; width?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const [{ lang }, query] = await Promise.all([params, searchParams])
  const sitovViews: Record<string, string> = {
    home: 'sitov-preview/home-motion', registration: 'registration',
    quest: 'sitov-preview/daily-quest?state=completed',
    pronunciation: 'sitov-preview/pronunciation',
  }
  const sitovPath = sitovViews[query.view ?? 'home']
  if (!sitovPath) notFound()
  const sitovWidth = query.width === '320' ? 320 : 390
  return <div style={{ padding: '24px', display: 'grid', justifyContent: 'center', gap: '12px' }}>
    <p style={{ fontSize: '14px', fontWeight: 700 }}>Sitov Academy · {sitovWidth}px responsive preview</p>
    <iframe title="Sitov Academy responsive preview" src={`/${lang}/${sitovPath}`}
      width={sitovWidth} height={844} style={{ border: '1px solid var(--border)', borderRadius: '20px', background: 'var(--canvas)' }} />
  </div>
}
