import SitovBillingSettings from '@/components/admin/SitovBillingSettings'
import { readSitovBillingSettings } from '@/lib/access/sitov-billing-staff'
export const dynamic='force-dynamic'
export default async function SitovBillingPage({params}:{params:Promise<{lang:string}>}) {
  const {lang}=await params
  const initial=await readSitovBillingSettings()
  return <SitovBillingSettings lang={lang} initial={initial} />
}
