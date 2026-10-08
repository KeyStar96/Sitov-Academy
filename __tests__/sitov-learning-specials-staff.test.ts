/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
import {createClient} from '@/utils/supabase/server'
import {loadSitovSpecialStaffCatalog} from '@/lib/learning/sitov-learning-specials-staff-server'
const uid='00000000-0000-4000-8000-000000000001'
const client={auth:{getUser:jest.fn()},rpc:jest.fn()}
beforeEach(()=>{jest.clearAllMocks();(createClient as jest.Mock).mockResolvedValue(client);client.auth.getUser.mockResolvedValue({data:{user:{id:uid}},error:null})})
it('rejects account/rights injection before RPC',async()=>{expect((await loadSitovSpecialStaffCatalog({nodeId:uid,studentId:uid})).ok).toBe(false);expect(client.rpc).not.toHaveBeenCalled()})
it('requires session and honors SQL role/MFA denial',async()=>{client.auth.getUser.mockResolvedValueOnce({data:{user:null},error:null});expect((await loadSitovSpecialStaffCatalog({nodeId:uid})).ok).toBe(false);client.rpc.mockResolvedValue({data:{ok:false,error:'not_found',retryable:false},error:null});expect(await loadSitovSpecialStaffCatalog({nodeId:uid})).toEqual({ok:false,error:'not_found',retryable:false})})
it('returns only exact strict diagnostic shape and treats malformed keys as retryable',async()=>{client.rpc.mockResolvedValueOnce({data:{ok:true,data:{definitions:[],runs:[]}},error:null});expect(await loadSitovSpecialStaffCatalog({nodeId:uid})).toEqual({ok:true,data:{definitions:[],runs:[]}});client.rpc.mockResolvedValue({data:{ok:true,data:{definitions:[],runs:[],serviceKey:'forbidden'}},error:null});expect(await loadSitovSpecialStaffCatalog({nodeId:uid})).toEqual({ok:false,error:'retryable_failure',retryable:true})})
