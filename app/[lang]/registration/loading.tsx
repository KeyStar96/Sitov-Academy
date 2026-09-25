/**
 * Registration Loading Skeleton
 *
 * Next.js App Router shows this instantly while the registration page
 * fetches data from Supabase (courses, exceptions). Mirrors the first step
 * of EnrollmentTerminal: top bar below the status bar, progress, question and
 * large course cards, so nothing jumps when the real page arrives.
 */
export default function RegistrationLoading() {
    return (
        <div className="relative w-full min-h-screen bg-[var(--canvas)]">
            <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:px-8 sm:pt-[calc(env(safe-area-inset-top,0px)+20px)] animate-pulse">
                <div className="h-12 w-44 rounded-full bg-[var(--surface-muted)]" />
                <div className="h-9 w-36 rounded-xl bg-[var(--surface-muted)]" />
            </div>
            <div className="mx-auto grid w-full max-w-[1180px] gap-7 px-4 pb-14 pt-5 sm:px-8 sm:pt-7 lg:grid-cols-[minmax(0,1fr)_clamp(360px,30vw,400px)] lg:items-start lg:gap-x-[clamp(32px,4vw,56px)] animate-pulse">
                <div className="grid min-w-0 gap-4">
                    <div className="h-5 w-48 max-w-full rounded bg-[var(--surface-muted)]" />
                    <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map(i => <div key={i} className={`h-2 rounded-full ${i === 1 ? "bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]" : "bg-[var(--surface-muted)]"}`} />)}
                    </div>
                    <div className="mt-2 h-10 w-full max-w-md rounded-lg bg-[var(--surface-muted)]" />
                    <div className="h-5 w-full max-w-sm rounded bg-[var(--surface-muted)]" />
                    <div className="mt-4 h-10 w-64 max-w-full rounded-xl bg-[var(--surface-muted)]" />
                    <div className="grid gap-3.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="grid gap-3 rounded-[22px] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[var(--surface)] p-[18px] shadow-[var(--shadow-sm)]">
                                <div className="flex items-center gap-3.5">
                                    <div className="h-12 w-12 shrink-0 rounded-[14px] bg-[var(--surface-muted)]" />
                                    <div className="h-6 w-48 max-w-full rounded bg-[var(--surface-muted)]" />
                                </div>
                                <div className="h-5 w-40 max-w-full rounded bg-[var(--surface-muted)]" />
                                <div className="h-16 w-full rounded-[14px] bg-[var(--surface-muted)]" />
                            </div>
                        ))}
                    </div>
                </div>
                {/* Desktop: the side column with "Weiter" beside the question. */}
                <div className="hidden gap-3 rounded-[26px] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] lg:grid">
                    <div className="h-5 w-56 max-w-full rounded bg-[var(--surface-muted)]" />
                    <div className="h-[58px] w-full rounded-[18px] bg-[var(--surface-muted)]" />
                </div>
            </div>
        </div>
    );
}
