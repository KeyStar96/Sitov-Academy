import { CheckCircle2, Info } from 'lucide-react'
import { toneForAuthStatus, type AuthStatusCode } from '@/lib/types/auth'

/**
 * Statusmeldung über einer Auth-Seite.
 *
 * Der Ton ergibt sich aus dem Statuscode und nicht mehr daraus, ob im Text das
 * Wort „erfolgreich" vorkommt. Fehlermeldungen sind sachlich gehalten – kein
 * Rot mit Ausrufezeichen, das Schuld suggeriert.
 *
 * `role="status"` statt `role="alert"`: Vorlesesoftware liest die Meldung nach
 * dem Seitenwechsel ruhig vor, ohne die Vorlesung zu unterbrechen.
 */
export default function AuthStatusMessage({
  status,
  message,
  title,
}: {
  status: AuthStatusCode
  message: string
  title?: string
}) {
  const isSuccess = toneForAuthStatus(status) === 'success'

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${
        isSuccess
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
          : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
      }`}
    >
      <span className={isSuccess ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
        {isSuccess ? (
          <CheckCircle2 size={26} aria-hidden="true" />
        ) : (
          <Info size={26} aria-hidden="true" />
        )}
      </span>
      <div className="text-lg text-slate-900 dark:text-slate-100">
        {title && <p className="mb-2 font-bold">{title}</p>}
        <p>{message}</p>
      </div>
    </div>
  )
}
