jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { updateStudentTrainerAccess } from '@/app/actions/admin'
import type { Trainer } from '@/lib/access/levels'
const input={userId:'00000000-0000-4000-8000-000000000001',level:'A1.1' as const,trainer:'exercises' as const,enabled:false}
const upsert=jest.fn()
function session(role: string | null, user=true) {
 const chain={ select:jest.fn().mockReturnThis(), eq:jest.fn().mockReturnThis(), single:jest.fn().mockResolvedValue({data:{role},error:null}),upsert }
 jest.mocked(createClient).mockResolvedValue({auth:{getUser:jest.fn().mockResolvedValue({data:{user:user?{id:'staff'}:null}})},from:jest.fn().mockReturnValue(chain)} as unknown as Awaited<ReturnType<typeof createClient>>)
}
beforeEach(()=>{jest.clearAllMocks();upsert.mockResolvedValue({error:null});jest.spyOn(console,'error').mockImplementation(()=>{})})
afterEach(()=>jest.restoreAllMocks())
test.each(['student',null])('role %s cannot change trainer access',async(role)=>{session(role);expect(await updateStudentTrainerAccess(input)).toEqual({success:false});expect(upsert).not.toHaveBeenCalled()})
test('unauthenticated callers cannot change trainer access',async()=>{session('teacher',false);expect((await updateStudentTrainerAccess(input)).success).toBe(false);expect(upsert).not.toHaveBeenCalled()})
test.each(['teacher','admin'])('%s can save the exact single override',async(role)=>{session(role);expect(await updateStudentTrainerAccess(input)).toEqual({success:true});expect(upsert).toHaveBeenCalledWith({user_id:input.userId,level:'A1.1',trainer:'exercises',enabled:false},{onConflict:'user_id,level,trainer'})})
test('invalid trainer input is rejected before database mutation',async()=>{session('teacher');expect((await updateStudentTrainerAccess({...input,trainer:'unknown' as Trainer})).success).toBe(false);expect(upsert).not.toHaveBeenCalled()})
test('database failure returns a safe error result',async()=>{session('teacher');upsert.mockResolvedValue({error:{message:'database detail'}});expect(await updateStudentTrainerAccess(input)).toEqual({success:false})})
