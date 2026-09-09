import { getDictionary } from '@/lib/dictionary'
import { ProfileI18nProvider } from '@/components/dashboard/ProfileI18nProvider'

export default async function ProfileLayout({ params, children }: {
  params: Promise<{ lang: string }>; children: React.ReactNode
}) {
  const { lang } = await params
  const dict = await getDictionary(lang)
  return <ProfileI18nProvider translations={dict.profile}>{children}</ProfileI18nProvider>
}
