import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import RegistrationIdentityConflicts from '@/components/admin/RegistrationIdentityConflicts'
import EnrollmentSignup from '@/components/registration/EnrollmentSignup'
import { resolveRegistrationIdentity } from '@/app/actions/registration-identity'
import { signup } from '@/app/actions/auth'
import { identityLabels } from '@/lib/registration-identity-i18n'

jest.mock('@/app/actions/registration-identity',()=>({resolveRegistrationIdentity:jest.fn()}))
jest.mock('@/app/actions/auth',()=>({signup:jest.fn()}))
const refresh=jest.fn()
jest.mock('next/navigation',()=>({useRouter:()=>({refresh})}))
const personId='00000000-0000-4000-8000-000000000001',authUserId='00000000-0000-4000-8000-000000000002'
const row={person_id:personId,display_name:'Anna',email:'family@example.test',booking_count:2,candidates:[{auth_user_id:authUserId,display_name:'Konto',email:'family@example.test',can_assign:true}]}
beforeEach(()=>jest.clearAllMocks())
it('requires an explicit account and personal verification before assigning an ambiguous registration',async()=>{
  jest.mocked(resolveRegistrationIdentity).mockResolvedValue({success:true,data:{person_id:personId,auth_user_id:authUserId,resolved:true}})
  render(<RegistrationIdentityConflicts conflicts={[row]} lang="de"/>)
  const button=screen.getByRole('button',{name:'Zuordnung bestätigen'})
  expect(button).toBeDisabled()
  fireEvent.change(screen.getByRole('combobox'),{target:{value:authUserId}})
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(button)
  await waitFor(()=>expect(resolveRegistrationIdentity).toHaveBeenCalledWith({personId,authUserId,confirmed:true}))
  expect(await screen.findByRole('status')).toHaveTextContent('Die Anmeldung wurde dem Konto zugeordnet.')
  expect(refresh).toHaveBeenCalled()
})
it('keeps blocked accounts visible but prevents a merge',()=>{
  render(<RegistrationIdentityConflicts conflicts={[{...row,candidates:[{...row.candidates[0],can_assign:false}]}]} lang="de"/>)
  fireEvent.change(screen.getByRole('combobox'),{target:{value:authUserId}})
  expect(screen.getByRole('status')).toHaveTextContent('Eine Zusammenführung ist hier nicht möglich')
  expect(screen.getByRole('button',{name:'Zuordnung bestätigen'})).toBeDisabled()
  expect(screen.getByRole('checkbox')).toBeDisabled()
})
it('offers signup only after an explicit opt-in and submits the original enrollment email to the existing signup action',async()=>{
  render(<EnrollmentSignup lang="ru" name="Anna Test" email="anna@example.test"/>)
  expect(screen.queryByLabelText('Пароль')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Создать аккаунт'}))
  fireEvent.change(screen.getByLabelText('Твой родной язык'),{target:{value:'ru'}})
  fireEvent.change(screen.getByLabelText('Пароль'),{target:{value:'StrongPass123'}})
  fireEvent.submit(screen.getByLabelText('Пароль').closest('form')!)
  await waitFor(()=>expect(signup).toHaveBeenCalledTimes(1))
  const form=jest.mocked(signup).mock.calls[0][0]
  expect(Object.fromEntries(form)).toEqual({lang:'ru',display_name:'Anna Test',email:'anna@example.test',native_language:'ru',password:'StrongPass123'})
})
it('includes all new messages in every supported language',()=>{
  const keys=Object.keys(identityLabels('de')).sort()
  for(const lang of ['de','en','ru','uk','tr']) {
    expect(Object.keys(identityLabels(lang)).sort()).toEqual(keys)
    expect(Object.values(identityLabels(lang)).every(value=>value.trim().length>0)).toBe(true)
  }
})
