import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import TeacherSidebar from '@/components/admin/TeacherSidebar'
import SitovBillingSettings from '@/components/admin/SitovBillingSettings'
import {saveSitovStaffBillingPrice,getSitovStaffBillingSettings} from '@/app/actions/sitov-commercial-access'
import {ACCESS_LEVELS} from '@/lib/access/levels'
import {sitovBillingAdminCopy,createAdminTranslator} from '@/lib/admin-i18n'
import {buildAdminNav,findActiveNavItem} from '@/lib/admin-navigation'
jest.unmock('lucide-react')
jest.mock('next/navigation',()=>({usePathname:()=>'/de/admin/settings/billing'}))
jest.mock('@/app/actions/sitov-commercial-access',()=>({saveSitovStaffBillingPrice:jest.fn(),getSitovStaffBillingSettings:jest.fn(),turnOffSitovStaffBilling:jest.fn()}))
jest.mock('@/components/motion/SitovTrainerHelp',()=>({__esModule:true,default:({title,children}:{title:string;children:React.ReactNode})=><details><summary>{title}</summary>{children}</details>}))
const settings={enabled:false,provider:'none' as const,revision:0,configuration_ready:false as const,missing:['provider_adapter' as const],products:ACCESS_LEVELS.map(level=>({level,amount_minor:null,currency:null,revision:0}))}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(saveSitovStaffBillingPrice).mockResolvedValue({ok:true,data:{revision:1}});jest.mocked(getSitovStaffBillingSettings).mockResolvedValue({ok:true,data:settings})})
it('starts with blank price/currency and exposes no activation toggle',()=>{render(<SitovBillingSettings lang="de" initial={{ok:true,data:settings}}/>);expect(screen.getByText('Käufe ausgeschaltet')).toBeInTheDocument();expect(screen.getByText('Zahlungsanbieter nicht konfiguriert')).toBeInTheDocument();expect(screen.getByLabelText('Preis in kleinster Währungseinheit')).toHaveValue('');expect(screen.getByLabelText('Währung (ISO-Code)')).toHaveValue('');expect(screen.getByRole('button',{name:'Preis speichern'})).toBeDisabled();expect(screen.queryByRole('switch')).not.toBeInTheDocument()})
it('saves only explicitly entered amount/currency at the product revision',async()=>{render(<SitovBillingSettings lang="de" initial={{ok:true,data:settings}}/>);fireEvent.change(screen.getByLabelText('Preis in kleinster Währungseinheit'),{target:{value:'250'}});fireEvent.change(screen.getByLabelText('Währung (ISO-Code)'),{target:{value:'eur'}});fireEvent.click(screen.getByRole('button',{name:'Preis speichern'}));await waitFor(()=>expect(saveSitovStaffBillingPrice).toHaveBeenCalledWith({level:'A1.1',amountMinor:250,currency:'EUR',revision:0}));await screen.findByText('Gespeichert');expect(screen.queryByText('Kein Preis festgelegt')).not.toBeInTheDocument();expect(screen.getByText('Käufe ausgeschaltet')).toBeInTheDocument()})
it('shows stale state with fresh reload rather than success',async()=>{jest.mocked(saveSitovStaffBillingPrice).mockResolvedValue({ok:false,error:'revision_conflict'});render(<SitovBillingSettings lang="de" initial={{ok:true,data:settings}}/>);fireEvent.change(screen.getByLabelText('Preis in kleinster Währungseinheit'),{target:{value:'250'}});fireEvent.change(screen.getByLabelText('Währung (ISO-Code)'),{target:{value:'EUR'}});fireEvent.click(screen.getByRole('button',{name:'Preis speichern'}));await screen.findByText('Die Einstellung wurde inzwischen geändert. Bitte neu laden.');expect(screen.getByRole('button',{name:'Preis speichern'})).toBeDisabled();expect(screen.queryByText('Gespeichert')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));await waitFor(()=>expect(getSitovStaffBillingSettings).toHaveBeenCalled())})
it.each(['de','en','ru','uk','tr'] as const)('renders localized billing and an actual navigation target for %s',lang=>{render(<SitovBillingSettings lang={lang} initial={{ok:true,data:settings}}/>);expect(screen.getByRole('heading',{name:sitovBillingAdminCopy[lang].title})).toBeInTheDocument();const nav=buildAdminNav(lang),item=findActiveNavItem(`/${lang}/admin/settings/billing`,nav);expect(item?.icon).toBe('sitovBilling');expect(item?.href).toBe(`/${lang}/admin/settings/billing`);expect(item&&createAdminTranslator({})(item.labelKey)).toBe(sitovBillingAdminCopy[lang].title);expect(nav.flatMap(s=>s.items).some(i=>i.href===`/${lang}/admin/content/pronunciation`)).toBe(true);expect(nav.flatMap(s=>s.items).some(i=>i.href.includes('special'))).toBe(false)})

it('integrates the genuine sidebar link, icon and active target with touch-sized navigation',()=>{
 render(<TeacherSidebar lang="de" size="comfortable" />)
 const link=screen.getByRole('link',{name:'Bezahlsystem'})
 expect(link).toHaveAttribute('href','/de/admin/settings/billing')
 expect(link).toHaveAttribute('aria-current','page')
 expect(link).toHaveClass('min-h-12')
 expect(link.querySelector('svg')).toHaveClass('lucide-credit-card')
})
