import {getCourseCatalog} from '@/app/actions/course-cms'
import CourseCMS from '@/components/admin/CourseCMS'
export default async function CoursesPage({params}:{params:Promise<{lang:string}>}) {
 const {lang}=await params,result=await getCourseCatalog()
 return <CourseCMS initial={result.success?result.data:[]} failed={!result.success} lang={lang}/>
}
