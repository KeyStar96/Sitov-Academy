'use client'

import { Loader2 } from 'lucide-react'
import { useId } from 'react'
import { useAdminTranslator } from './AdminI18nProvider'
import { useBlackboard } from './BlackboardProvider'

export default function BlackboardEditor({
  studentId, studentName, compact = false,
}: {
  studentId: string
  studentName: string
  compact?: boolean
}) {
  const t = useAdminTranslator()
  const { getBoard, setNoteText, setDiscountInput } = useBlackboard()
  const board = getBoard(studentId)
  const instanceId = useId()
  const noteId = `${studentId}-${instanceId}-note`
  const discountId = `${studentId}-${instanceId}-discount`
  const statusText = board.status === 'saving' ? t('blackboard_saving')
    : board.status === 'saved' ? t('blackboard_saved')
    : board.status === 'error' ? t('blackboard_save_failed')
    : board.status === 'invalid' ? t('blackboard_invalid_discount')
    : ''

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('blackboard_title')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('blackboard_intro')}</p>
        </div>
      )}
      <label htmlFor={noteId} className="block text-sm font-bold text-slate-700 dark:text-slate-300">
        {t('blackboard_note_label')}
      </label>
      <textarea
        id={noteId}
        value={board.noteText}
        onChange={event => setNoteText(studentId, event.target.value)}
        placeholder={t('blackboard_note_placeholder')}
        aria-label={`${t('blackboard_note_label')}: ${studentName}`}
        rows={compact ? 2 : 4}
        className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={discountId} className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            {t('blackboard_discount_label')}
          </label>
          <div className="mt-1 flex min-h-11 items-center gap-2">
            <input
              id={discountId}
              inputMode="decimal"
              value={board.discountInput}
              onChange={event => setDiscountInput(studentId, event.target.value)}
              aria-invalid={!board.discountValid}
              aria-label={`${t('blackboard_discount_label')}: ${studentName}`}
              className="h-12 w-24 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t('blackboard_discount_suffix')}</span>
          </div>
        </div>
        {board.status === 'saving' && (
          <Loader2 size={18} aria-hidden="true" className="mb-3 shrink-0 animate-spin text-slate-500" />
        )}
      </div>
      <p
        className={`min-h-6 text-sm leading-relaxed ${board.status === 'error' || board.status === 'invalid' ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`}
        role={board.status === 'error' || board.status === 'invalid' ? 'alert' : 'status'}
        aria-live={board.status === 'error' || board.status === 'invalid' ? 'assertive' : 'polite'}
      >
        {statusText}
      </p>
    </div>
  )
}
