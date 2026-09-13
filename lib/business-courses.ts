import { z } from 'zod'
import type { CourseConfig, Day } from './course-config'
const text = (max: number) => z.string().trim().max(max).refine(value => !/[<>\u0000-\u001f]/.test(value))
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''))
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const courseEditorSchema = z.object({
  id:z.string().uuid().optional(),slug:z.string().regex(/^[a-z0-9][a-z0-9_-]{1,99}$/),title:text(180).min(1),description:z.string().trim().max(3000),
  type:z.enum(['presence','online']),category:z.enum(['german','speaking','online','private']),level:text(30),price:z.number().finite().min(0).max(10000),
  unit_duration:z.number().int().min(15).max(180),instructor:z.enum(['standard','special']),start_date:date,end_date:date,trial_lessons:z.boolean(),
  sort_order:z.number().int().min(0).max(100000),archived:z.boolean(),
  schedules:z.array(z.object({weekday:z.number().int().min(1).max(7),start_time:time,end_time:time,alternate_start_time:time.or(z.literal('')),alternate_end_time:time.or(z.literal(''))})
    .refine(row=>row.end_time>row.start_time && ((!row.alternate_start_time&&!row.alternate_end_time)||(row.alternate_end_time>row.alternate_start_time && !!row.alternate_start_time)))).max(30),
  translations:z.array(z.object({locale:z.enum(['de','en','ru','uk','tr']),title:text(180).min(1),description:z.string().trim().max(3000)})).max(5).refine(rows=>new Set(rows.map(row=>row.locale)).size===rows.length),
  exceptions:z.array(z.object({date:date.refine(Boolean),reason:text(250).min(1)})).max(365),
}).strict().refine(course=>!course.start_date||!course.end_date||course.end_date>=course.start_date)
export type CourseEditor = z.infer<typeof courseEditorSchema>
export const DAYS: Day[] = ['Mo','Di','Mi','Do','Fr','Sa','So']
export function courseText(course: CourseConfig, locale:string): {title:string;description:string} {
  const text = course.translations?.find(item=>item.locale===locale)
  return {title:text?.title||course.title||'',description:text?.description||course.description||''}
}
