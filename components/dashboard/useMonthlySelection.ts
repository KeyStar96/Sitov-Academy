'use client'

import { useEffect, useRef, useState } from 'react'
import { saveNextMonthBooking, getProfileMonthlyState } from '@/app/actions/monthly-bookings'
import type { MonthlySelection, ProfileMonthlyState } from '@/lib/types/monthly-bookings'
import type { ProfileTranslationKey } from '@/lib/profile-i18n'

/** Serialize writes while keeping the latest intent visible. Each request uses
 * the previous acknowledgement as its compare-and-swap token. Revalidation or
 * an earlier response must never overwrite a more recent optimistic selection.
 */
export function useMonthlySelection(initial: ProfileMonthlyState) {
  const [state, setState] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<ProfileTranslationKey | null>(null)
  const [hasError, setHasError] = useState(false)
  const confirmed = useRef(initial)
  const queued = useRef<MonthlySelection | null>(null)
  const running = useRef(false)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!running.current) { confirmed.current = initial; setState(initial) }
  }, [initial])
  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  async function drain() {
    if (running.current) return
    running.current = true
    try {
      while (queued.current) {
        const selection = queued.current
        queued.current = null
        const previous = confirmed.current
        try {
          const result = await saveNextMonthBooking({
            targetMonth: previous.targetMonth, ...selection,
            expected: previous.booking ? {
              id: previous.booking.id, revision: previous.booking.revision,
            } : null,
          })
          if (result.success === false) {
            throw new Error(result.error)
          }
          confirmed.current = { ...previous, booking: result.data, source: 'booking',
            selection: { courseSelections: result.data.courseSelections, paused: result.data.status === 'cancelled' } }
          if (mounted.current && !queued.current) {
            setState(confirmed.current)
            setMessage(selection.paused ? 'pause_saved' : 'booking_saved')
          }
        } catch (error: unknown) {
          // A lost response may still have committed. Re-read before deciding
          // what to roll back to; never advertise an unknown write as saved.
          queued.current = null
          try {
            const fresh = await getProfileMonthlyState()
            if (fresh.success === true) confirmed.current = fresh.data
          } catch { /* Last acknowledged state remains the safe fallback. */ }
          queued.current = null
          if (mounted.current) {
            setState(confirmed.current)
            setHasError(true)
            setMessage(error instanceof Error && error.message === 'conflict' ? 'booking_conflict'
              : error instanceof Error && error.message === 'month_changed' ? 'month_changed' : 'save_failed')
          }
          break
        }
      }
    } finally {
      running.current = false
      if (mounted.current) setSaving(false)
    }
  }

  function change(selection: MonthlySelection) {
    queued.current = selection
    setState(current => ({ ...current, selection }))
    setHasError(false)
    setMessage(null)
    setSaving(true)
    void drain()
  }
  return { state, saving, message, hasError, change }
}
