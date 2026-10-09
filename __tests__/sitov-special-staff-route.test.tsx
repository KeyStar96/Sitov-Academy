/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/learning/sitov-learning-specials-staff-server',()=>({loadSitovSpecialStaffTargets:jest.fn()}))
jest.mock('next/navigation',()=>({redirect:jest.fn((url:string)=>{throw new Error(`redirect:${url}`)}),notFound:jest.fn(()=>{throw new Error('notFound')})}))
jest.mock('@/components/admin/SitovLearningSpecialStaffTargets',()=>({__esModule:true,default:jest.fn()}))
import {createClient} from '@/utils/supabase/server'
import {loadSitovSpecialStaffTargets} from '@/lib/learning/sitov-learning-specials-staff-server'
import Page,{generateMetadata} from '@/app/[lang]/teacher/content/learning-path/specials/page'
import Layout from '@/app/[lang]/teacher/content/learning-path/specials/layout'
import ExistingLayout from '@/app/[lang]/admin/layout'
// The route imports the existing server shell, without duplicating its auth implementation.
jest.mock('@/app/[lang]/admin/layout',()=>({__esModule:true,default:jest.fn()}))
const uid='00000000-0000-4000-8000-000000000001',node='00000000-0000-4000-8000-000000000002',target={nodeId:node,unitId:uid,title:'Artikel',level:'A1.1',sourceSha256:'e'.repeat(64),activeDefinitionId:null},client={auth:{getUser:jest.fn()}}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);client.auth.getUser.mockResolvedValue({data:{user:{id:uid}},error:null});jest.mocked(loadSitovSpecialStaffTargets).mockResolvedValue({ok:true,data:[target]})})
it.each(['de','en','ru','uk','tr'])('binds %s route to verified cookie actor and real readonly106 index',async lang=>{const page=await Page({params:Promise.resolve({lang})});expect(page.props).toEqual({accountKey:uid,lang,initial:{ok:true,data:[target]}});expect(loadSitovSpecialStaffTargets).toHaveBeenCalledWith({level:null});expect((await generateMetadata({params:Promise.resolve({lang})})).robots).toEqual({index:false,follow:false})})
it('reuses exact existing teacher role/MFA shell',()=>{expect(Layout).toBe(ExistingLayout)})
it('rejects invalid locale before cookie/index access',async()=>{await expect(Page({params:Promise.resolve({lang:'xx'})})).rejects.toThrow('notFound');expect(createClient).not.toHaveBeenCalled();expect(loadSitovSpecialStaffTargets).not.toHaveBeenCalled()})
it('redirects missing/invalid cookie auth before loading index',async()=>{for(const auth of [{data:{user:null},error:null},{data:{user:{id:uid}},error:{code:'invalid'}}]){client.auth.getUser.mockResolvedValue(auth);await expect(Page({params:Promise.resolve({lang:'ru'})})).rejects.toThrow('redirect:/ru/login')}expect(loadSitovSpecialStaffTargets).not.toHaveBeenCalled()})
it('does not pass private targets for current DB denial or malformed output',async()=>{jest.mocked(loadSitovSpecialStaffTargets).mockResolvedValue({ok:false,error:'not_found',retryable:false});expect((await Page({params:Promise.resolve({lang:'uk'})})).props.initial).toEqual({ok:false,error:'not_found',retryable:false});jest.mocked(loadSitovSpecialStaffTargets).mockResolvedValue({ok:true,data:[{...target,pool:[]}]} as never);expect((await Page({params:Promise.resolve({lang:'en'})})).props.initial).toEqual({ok:false,error:'not_found',retryable:false})})
it('handles session expiry from real DAL independently of the outer layout',async()=>{jest.mocked(loadSitovSpecialStaffTargets).mockResolvedValue({ok:false,error:'authentication_required',retryable:false});await expect(Page({params:Promise.resolve({lang:'tr'})})).rejects.toThrow('redirect:/tr/login')})
