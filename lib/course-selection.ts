import { z } from 'zod'

export const requestedUnitsSchema = z.number().int().min(1).max(1000)
export const courseSelectionSchema = z.object({
  courseId: z.string().uuid().transform(value => value.toLowerCase()),
  requestedUnits: requestedUnitsSchema.optional(),
}).strict()
export const courseSelectionsSchema = z.array(courseSelectionSchema).max(100)
  .refine(rows => new Set(rows.map(row => row.courseId)).size === rows.length)
export type CourseSelection = z.infer<typeof courseSelectionSchema>

/** The DB validates the course category, quantity and authoritative unit price. */
export function courseSelectionsForRpc(selections: CourseSelection[]) {
  return selections.map(row => ({
    course_id: row.courseId,
    ...(row.requestedUnits === undefined ? {} : { requested_units: row.requestedUnits }),
  }))
}
