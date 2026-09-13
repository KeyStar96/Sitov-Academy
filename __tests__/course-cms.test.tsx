import React from 'react'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import CourseCMS from '@/components/admin/CourseCMS'
import {saveCourse} from '@/app/actions/course-cms'
import {courseEditorSchema,type CourseEditor} from '@/lib/business-courses'
import {calculateMonthlyStats} from '@/lib/course-calculations'
const refresh=jest.fn()
jest.mock('lucide-react',()=>({Plus:()=>null,Pencil:()=>null,Archive:()=>null,CalendarDays:()=>null,Loader2:()=>null,X:()=>null}))
jest.mock('next/navigation',()=>({useRouter:()=>({refresh})}))
jest.mock('@/app/actions/course-cms',()=>({saveCourse:jest.fn()}))
const course:CourseEditor={id:'00000000-0000-4000-8000-000000000001',slug:'future-c2',title:'Neue Gesprächsrunde',description:'Ein neuer Kurs',type:'online',category:'speaking',level:'C2',unit_price:15,unit_minutes:60,start_date:'',end_date:'',trial_lessons:false,sort_order:125,archived:false,schedules:[{weekday:6,start_time:'10:00',end_time:'11:00'}],translations:[],exceptions:[]}
beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 Object.defineProperty(globalThis,'structuredClone',{configurable:true,value:<T,>(value:T):T=>JSON.parse(JSON.stringify(value))})
})
beforeEach(()=>{jest.clearAllMocks();jest.mocked(saveCourse).mockResolvedValue({success:true,data:{id:course.id!}})})
it('edits dynamic course copy and archives within a bounded dialog, retaining the public course identity',async()=>{
 render(<CourseCMS initial={[course]} lang="de" failed={false}/>);fireEvent.click(screen.getByRole('button',{name:'Bearbeiten'}))
 expect(await screen.findByRole('dialog')).toHaveAttribute('aria-modal','true')
 fireEvent.change(screen.getByLabelText('Kurstitel'),{target:{value:'Gesprächsrunde am Samstag'}})
 fireEvent.click(screen.getByLabelText('Kurs archivieren'));fireEvent.click(screen.getByRole('button',{name:'Speichern'}))
 await waitFor(()=>expect(saveCourse).toHaveBeenCalledWith(expect.objectContaining({id:course.id,title:'Gesprächsrunde am Samstag',archived:true})))
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(refresh).toHaveBeenCalled()
})
it('retains unsaved work and reports server failures inside the editor',async()=>{
 jest.mocked(saveCourse).mockResolvedValue({success:false,error:'request_failed'})
 render(<CourseCMS initial={[course]} lang="de" failed={false}/>);fireEvent.click(screen.getByRole('button',{name:'Bearbeiten'}))
 fireEvent.change(screen.getByLabelText('Kurstitel'),{target:{value:'Entwurf behalten'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Der Kurs konnte nicht gespeichert werden')
 expect(screen.getByLabelText('Kurstitel')).toHaveValue('Entwurf behalten');expect(refresh).not.toHaveBeenCalled()
})
it('validates schedule duration, prices, duplicate locales and unsafe titles',()=>{
 expect(courseEditorSchema.safeParse(course).success).toBe(true)
 expect(courseEditorSchema.safeParse({...course,unit_price:-1}).success).toBe(false)
 expect(courseEditorSchema.safeParse({...course,title:'<script>'}).success).toBe(false)
 expect(courseEditorSchema.safeParse({...course,schedules:[{...course.schedules[0],end_time:'09:00'}]}).success).toBe(false)
 expect(courseEditorSchema.safeParse({...course,translations:[{locale:'en',title:'A',description:''},{locale:'en',title:'B',description:''}]}).success).toBe(false)
})
it('public price estimates respect course date bounds and weekend sessions',()=>{
 const stats=calculateMonthlyStats({id:course.id!,slug:'',type:'online',unitPrice:15,unitMinutes:60,startDate:'2026-10-10',endDate:'2026-10-17',sessions:[{day:'Sa',startTime:'10:00',endTime:'11:00'}]},'de',9,2026)
 expect(stats.totalUnits).toBe(2);expect(stats.sessionCount).toBe(2)
})
it('private lessons use quantities and appointment scheduling while retaining the chosen teaching format',async()=>{
 render(<CourseCMS initial={[course]} lang="de" failed={false}/>);fireEvent.click(screen.getByRole('button',{name:'Bearbeiten'}))
 fireEvent.change(screen.getByLabelText('Kategorie'),{target:{value:'private'}})
 expect(screen.getByLabelText('Probestunde möglich')).toBeDisabled()
 expect(screen.queryByRole('button',{name:'Termin hinzufügen'})).not.toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Unterrichtsform'),{target:{value:'presence'}})
 fireEvent.change(screen.getByLabelText('Preis je Unterrichtseinheit (€)'),{target:{value:'25'}})
 fireEvent.change(screen.getByLabelText('Minuten je Einheit'),{target:{value:'45'}})
 fireEvent.click(screen.getByRole('button',{name:'Speichern'}))
 await waitFor(()=>expect(saveCourse).toHaveBeenCalledWith(expect.objectContaining({category:'private',type:'presence',unit_price:25,unit_minutes:45,schedules:[],trial_lessons:false})))
})
