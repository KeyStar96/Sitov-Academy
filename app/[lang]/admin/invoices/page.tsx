import RegistrationPageContent from '@/components/admin/RegistrationPageContent'
export const dynamic='force-dynamic'
export default async function InvoicesPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{month?:string}>}) {
 const [{lang},{month}]=await Promise.all([params,searchParams])
 return <RegistrationPageContent lang={lang} month={month} mode="invoices"/>
}
