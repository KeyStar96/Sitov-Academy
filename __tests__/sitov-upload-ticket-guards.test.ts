jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/lib/exam-preparation/server',()=>({...jest.requireActual('@/lib/exam-preparation/server'),getExamActor:jest.fn()}))
jest.mock('@/lib/exam-simulation/server',()=>({...jest.requireActual('@/lib/exam-simulation/server'),getSimulationActor:jest.fn(),loadSimulationRun:jest.fn(),simulationSnapshot:jest.fn()}))
import {createAdminClient} from '@/utils/supabase/admin'
import {getExamActor} from '@/lib/exam-preparation/server'
import {getSimulationActor,loadSimulationRun,simulationSnapshot} from '@/lib/exam-simulation/server'
import {createExamUpload} from '@/app/actions/exam-preparation'
import {createSimulationUpload} from '@/app/actions/exam-simulation'
import {examPrepError} from '@/lib/exam-preparation/ui-copy'
import {sitovSimulationError} from '@/lib/exam-simulation/ui-copy'
const user='00000000-0000-4000-8000-000000000001',run='00000000-0000-4000-8000-000000000002'
function setup(ticketError:unknown=null,signedError:unknown=null){
 const insert=jest.fn(async()=>({error:ticketError}))
 const eq=jest.fn(async()=>({error:null}))
 const remove=jest.fn(()=>({eq}))
 const from=jest.fn(()=>({insert,delete:remove}))
 const sign=jest.fn(async()=>({data:signedError?null:{token:'upload-token',signedUrl:'https://upload.test'},error:signedError}))
 jest.mocked(createAdminClient).mockReturnValue({from,storage:{from:jest.fn(()=>({createSignedUploadUrl:sign}))}} as unknown as ReturnType<typeof createAdminClient>)
 jest.mocked(getExamActor).mockResolvedValue({userId:user,role:'student'} as Awaited<ReturnType<typeof getExamActor>>)
 jest.mocked(getSimulationActor).mockResolvedValue({userId:user,role:'student'} as Awaited<ReturnType<typeof getSimulationActor>>)
 jest.mocked(loadSimulationRun).mockResolvedValue({} as Awaited<ReturnType<typeof loadSimulationRun>>)
 jest.mocked(simulationSnapshot).mockReturnValue({id:run,status:'active',expiresAt:new Date(Date.now()+60000).toISOString(),tasks:[{id:'speaking',type:'speaking'}]} as ReturnType<typeof simulationSnapshot>)
 return {insert,remove,eq,sign}
}
const requests=[
 ()=>createExamUpload({mimeType:'audio/webm',bytes:123,kind:'speaking'}),
 ()=>createSimulationUpload({runId:run,taskId:'speaking',mimeType:'audio/webm',bytes:123}),
]
beforeEach(()=>jest.clearAllMocks())
it.each(requests)('binds the declared size and owner to a database-limited ticket before signing',async request=>{
 const {insert,sign}=setup()
 const result=await request()
 expect(result).toMatchObject({success:true,token:'upload-token'})
 expect(insert).toHaveBeenCalledWith(expect.objectContaining({student_id:user,expected_bytes:123,kind:'speaking',path:expect.stringMatching(new RegExp(`^${user}/speaking/`))}))
 expect(sign).toHaveBeenCalledWith(result.path,{upsert:false})
})
it.each(requests)('refuses to sign another URL after a daily or pending-ticket rejection',async request=>{
 const {sign}=setup({code:'PT429'})
 expect(await request()).toMatchObject({success:false,error:expect.stringContaining('Uploadkontingent')})
 expect(sign).not.toHaveBeenCalled()
})
it.each(requests)('releases unused pending slots when URL signing fails',async request=>{
 const {sign,remove,eq}=setup(null,{message:'storage unavailable'})
 expect(await request()).toMatchObject({success:false})
 expect(sign).toHaveBeenCalledTimes(1)
 expect(remove).toHaveBeenCalledTimes(1)
 expect(eq).toHaveBeenCalledWith('path',expect.stringMatching(new RegExp(`^${user}/speaking/`)))
})
it.each(['en','ru','uk','tr'])('keeps the upload quota feedback in the selected %s interface',lang=>{
 const source='Dein Uploadkontingent ist erreicht. Bitte versuche es später erneut.'
 expect(examPrepError(lang,source,'Fehler')).not.toBe(source)
 expect(sitovSimulationError(lang,source)).toBe(examPrepError(lang,source,'Fehler'))
})
