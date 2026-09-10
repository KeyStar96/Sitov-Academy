import type { CourseConfig } from '@/lib/course-config'

// These course keys predate the current Level 1 / 2 / 3 names.
const germanLevelOrder: Record<string, number> = {
  de50_a1_1_replacement_2026_07: 0,
  de50_a1_1: 1,
  de50_a1_2: 2,
  de50_a2: 3,
}
const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const languageLevels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

function group(course: CourseConfig): number {
  if (course.translationKey === 'private_lesson') return 3
  if (course.translationKey.startsWith('speech_')) return 1
  if (course.type === 'online') return 2
  return 0
}

function position(course: CourseConfig): number {
  if (group(course) === 0) return germanLevelOrder[course.translationKey] ?? 99
  if (group(course) === 1) {
    return Math.min(99, ...course.sessions.map(session => {
      const day = weekdays.indexOf(session.day)
      return day < 0 ? 99 : day
    }))
  }
  if (group(course) === 2) {
    const level = languageLevels.findIndex(level => course.translationKey.includes(`_${level}`))
    return level < 0 ? 99 : level
  }
  return course.type === 'presence' ? 0 : 1
}

/** Locale-independent order; never reorder the shared cached course array. */
export function sortMarketingCourses(courses: readonly CourseConfig[]): CourseConfig[] {
  return [...courses].sort((a, b) =>
    group(a) - group(b) || position(a) - position(b) ||
    a.translationKey.localeCompare(b.translationKey, 'en', { numeric: true }) ||
    a.id.localeCompare(b.id, 'en', { numeric: true })
  )
}
