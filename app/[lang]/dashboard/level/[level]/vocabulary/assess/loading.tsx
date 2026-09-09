import { VOCABULARY_FALLBACKS } from '@/lib/vocabulary-i18n'

/** Skeleton in der Silhouette des Einstufungs-Durchlaufs – kein Layout-Sprung. */
export default function VocabularyAssessLoading() {
  return (
    <div
      className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-900/5 dark:bg-slate-900 dark:ring-slate-800"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{VOCABULARY_FALLBACKS.loading}</span>

      <div className="mb-6 space-y-3 border-b border-gray-200 pb-6 dark:border-slate-700">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700" />
        <div className="h-6 w-96 max-w-full animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700" />
      </div>

      <div className="mx-auto flex h-[36rem] max-w-2xl flex-col overflow-hidden rounded-3xl bg-gray-50 ring-1 ring-gray-900/10 dark:bg-slate-800 dark:ring-slate-700 sm:h-[42rem]">
        <div className="flex h-[14.5rem] flex-col items-center justify-center gap-4 border-b border-gray-100 sm:h-[18rem] dark:border-slate-700">
          <div className="h-24 w-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-700 sm:h-36 sm:w-36" />
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700" />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="h-16 w-full max-w-md animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  )
}
