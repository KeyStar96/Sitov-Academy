import type {CourseConfig} from './course-config'
/** The teacher controls catalog order; new courses need no application release. */
export function sortMarketingCourses(courses:readonly CourseConfig[]):CourseConfig[] {
 return [...courses].sort((a,b)=>(a.sortOrder??100)-(b.sortOrder??100)||a.id.localeCompare(b.id))
}
