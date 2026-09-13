import { z } from 'zod'

export const profileRoleSchema = z.enum(['student', 'teacher', 'admin'])
export type ProfileRole = z.infer<typeof profileRoleSchema>
export const uuidSchema = z.string().uuid().transform(value => value.toLowerCase())

export type BackendActionError =
  | 'not_authenticated' | 'not_authorized' | 'invalid_input'
  | 'not_found' | 'conflict' | 'request_failed' | 'month_changed'
export type BackendActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: BackendActionError }

/** Plain text only. Normalize whitespace, reject markup and hidden controls.
 * Render as escaped text in React; never use dangerouslySetInnerHTML.
 * Existing address snapshots stay unchanged when a new form is validated.
 */
export function plainTextSchema(max: number) {
  return z.string().max(max).transform(value => value.replace(/\r\n?/g, '\n').trim())
    .pipe(z.string().min(1).max(max).refine(value =>
      !/[<>\u0000-\u0008\u000B-\u001F\u007F]/u.test(value)))
}
