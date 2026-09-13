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
  const { getBoard, setNoteText, retrySave } = useBlackboard()
  const board = getBoard(studentId)
  const instanceId = useId()
  const noteId = `${studentId}-${instanceId}-note`
  const statusText = board.status === 'saving' ? t('blackboard_saving')
    : board.status === 'saved' ? t('blackboard_saved')
    : board.status === 'error' ? t('blackboard_save_failed')
    : ''

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">{t('blackboard_title')}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t('blackboard_intro')}</p>
        </div>
      )}
      <label htmlFor={noteId} className="block text-sm font-bold text-[var(--foreground)]">
        {t('blackboard_note_label')}
      </label>
      <textarea
        id={noteId}
        value={board.noteText}
        onChange={event => setNoteText(studentId, event.target.value)}
        placeholder={t('blackboard_note_placeholder')}
        aria-label={`${t('blackboard_note_label')}: ${studentName}`}
        rows={compact ? 2 : 4}
        className="min-h-12 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-base leading-relaxed text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      />
      {board.status === 'saving' && (
        <Loader2 size={18} aria-hidden="true" className="animate-spin text-[var(--muted)]" />
      )}
      <p
        className={`min-h-6 text-sm leading-relaxed ${board.status === 'error' || board.status === 'invalid' ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`}
        role={board.status === 'error' || board.status === 'invalid' ? 'alert' : 'status'}
        aria-live={board.status === 'error' || board.status === 'invalid' ? 'assertive' : 'polite'}
      >
        {statusText}
      </p>
      {board.status === 'error' && <button type="button" onClick={() => retrySave(studentId)} className="min-h-12 rounded-xl border border-[var(--border)] px-4 text-base font-semibold">{t('access_retry')}</button>}
    </div>
  )
}
