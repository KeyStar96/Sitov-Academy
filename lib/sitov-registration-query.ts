/** Public selection only; repeated or malformed query values never alter a booking. */
export function sitovRegistrationQuery(query: Record<string, string | string[] | undefined>) {
  const courseId = query.courseId
  return {
    initialCourseId: typeof courseId === 'string' && courseId.length <= 200 ? courseId : undefined,
    isTrial: query.trial === '1',
  }
}
