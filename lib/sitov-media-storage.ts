import { SITOV_PLATFORM_LEVELS } from '@/lib/access/levels'

export interface SitovMediaStorageLevel { level: string; bytes: number; limit_bytes: number }

/** Binary units retain useful precision for small files instead of rounding to 0 GiB. */
export function sitovStorageBytes(value: number, lang: string): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const
  const unit = value > 0 ? Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(value) / Math.log(1024)))) : 0
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value / 1024 ** unit)} ${units[unit]}`
}

/** Legacy and unassigned material stays counted without offering exam-only trainer levels. */
export function sitovStorageTrainerLevels(levels: readonly SitovMediaStorageLevel[], courseBytes: number) {
  const trainerLevels = SITOV_PLATFORM_LEVELS.flatMap(level => {
    const usage = levels.find(item => item.level === level)
    return usage ? [usage] : []
  })
  return {
    trainerLevels,
    otherCourseBytes: Math.max(0, courseBytes - trainerLevels.reduce((total, item) => total + item.bytes, 0)),
  }
}
