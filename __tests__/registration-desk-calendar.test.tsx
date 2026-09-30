import { fireEvent, render, screen } from '@testing-library/react'
import RegistrationDesk from '@/components/admin/RegistrationDesk'
import type { RegistrationOverview, StaffRegistration } from '@/lib/types/admin-registrations'

jest.unmock('lucide-react')
jest.mock('@/app/actions/admin-registrations',()=>({confirmRegistration:jest.fn(),declineRegistration:jest.fn(),saveManualInvoiceStatus:jest.fn()}))
jest.mock('next/navigation',()=>({useRouter:()=>({refresh:jest.fn(),push:jest.fn()})}))
const booking:StaffRegistration={id:'booking',source:'monthly_booking',personId:'person',profileId:'profile',createdAt:null,startDate:'2026-10-01',targetMonth:'2026-10-01',status:'confirmed',contact:{name:'Billing Test',email:'billing@example.test',phone:null,street:null,zip:null,city:null,birthDate:null},courses:[{id:'course',title:'Thursday',unitPrice:10,unitMinutes:45,units:10,amount:100,requestedUnits:null}],totalPrice:100,consents:null}

it('shows an issued invoice needing correction in the open queue while retaining its original total',()=>{
 const initial:RegistrationOverview={registrations:[booking],invoices:[{source:'monthly_booking',sourceId:'booking',month:'2026-10-01',status:'created',reference:'RE-1',createdAt:'2026-09-30',calendarAdjustmentAmount:-20}],targetMonth:'2026-10-01'}
 render(<RegistrationDesk initial={initial} lang="de" mode="invoices"/>)
 expect(screen.getByRole('heading',{name:'Billing Test'})).toBeVisible()
 expect(screen.getByRole('status')).toHaveTextContent('korrigierte Monatsbetrag ist 80,00 €')
 expect(screen.getByRole('status')).toHaveTextContent('Änderung: -20,00 €')
 expect(screen.getAllByText('100,00 €')).toHaveLength(2)
 expect(screen.getByRole('button',{name:'Wieder als offen markieren'})).toBeVisible()
})

it('adopts recalculated server prices on refresh and keeps the current search',()=>{
 const initial:RegistrationOverview={registrations:[booking],invoices:[],targetMonth:'2026-10-01'}
 const {rerender}=render(<RegistrationDesk initial={initial} lang="de" mode="invoices"/>)
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Billing'}})
 rerender(<RegistrationDesk initial={{...initial,registrations:[{...booking,courses:[{...booking.courses[0],units:8,amount:80}],totalPrice:80}]}} lang="de" mode="invoices"/>)
 expect(screen.getByRole('searchbox')).toHaveValue('Billing')
 expect(screen.getAllByText('80,00 €')).toHaveLength(2)
 expect(screen.queryByText('100,00 €')).not.toBeInTheDocument()
})
