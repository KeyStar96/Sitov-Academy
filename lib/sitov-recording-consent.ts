/** Regular online groups and their online trial lessons are recorded in Teams. */
export function requiresSitovRecordingConsent(course: { type: string; category?: string | null }): boolean {
  return course.type === 'online' && course.category !== 'private'
}
