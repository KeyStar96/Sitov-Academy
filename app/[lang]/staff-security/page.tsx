import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/actions/auth'
import AuthShell from '@/components/auth/AuthShell'
import SitovStaffMfa from '@/components/auth/SitovStaffMfa'
import ConsentSettingsButton from '@/components/analytics/ConsentSettingsButton'
import { getDictionary } from '@/lib/dictionary'
import { sitovStaffMfaCopy } from '@/lib/sitov-staff-mfa-copy'
import styles from '@/components/auth/SitovStaffMfa.module.css'

export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: sitovStaffMfaCopy(lang).title, robots: { index: false, follow: false } }
}
export default async function SitovStaffSecurityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) redirect(`/${lang}/login`)
  const { data: profile } = await client.from('profiles').select('role,sitov_mfa_required').eq('id', user.id).single()
  if (profile?.role === 'teacher') redirect(`/${lang}/admin`)
  if (profile?.role !== 'admin') redirect(`/${lang}/dashboard`)
  const copy = sitovStaffMfaCopy(lang)
  const dictionary = await getDictionary(lang)
  return <AuthShell lang={lang} title={copy.title} description={copy.description}>
    <SitovStaffMfa lang={lang} copy={copy} required={profile.sitov_mfa_required} />
    <form action={async () => { 'use server'; await logout(lang) }}>
      <button type="submit" className={`academy-button academy-button-outline ${styles.sitovButton}`}>{copy.logout}</button>
    </form>
    <ConsentSettingsButton label={dictionary.consent.settings_button} className={`academy-button academy-button-outline ${styles.sitovButton}`} />
  </AuthShell>
}
