/**
 * Registration Loading Skeleton
 *
 * Next.js App Router shows this instantly while the registration page
 * fetches data from Supabase (courses, exceptions). Mirrors the first step
 * of EnrollmentTerminal: top bar, progress, question and large course cards.
 */
export default function RegistrationLoading() {
    return (
        <div className="relative w-full min-h-screen bg-[var(--canvas)]">
            <div className="mx-auto grid w-full max-w-[1180px] gap-7 px-4 pb-14 pt-4 sm:px-8 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-12 animate-pulse">
                <div className="grid min-w-0 gap-4">
                    <div className="flex min-h-12 items-center justify-between gap-4">
                        <div className="h-5 w-36 rounded bg-[var(--surface-muted)]" />
                        <div className="h-8 w-28 rounded bg-[var(--surface-muted)]" />
                    </div>
                    <div className="h-5 w-48 max-w-full rounded bg-[var(--surface-muted)]" />
                    <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map(i => <div key={i} className={`h-2 rounded-full ${i === 1 ? "bg-[var(--accent)]/30" : "bg-[var(--surface-muted)]"}`} />)}
                    </div>
                    <div className="mt-2 h-10 w-full max-w-md rounded-lg bg-[var(--surface-muted)]" />
                    <div className="h-5 w-full max-w-sm rounded bg-[var(--surface-muted)]" />
                    <div className="mt-4 grid gap-3.5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex min-h-24 items-start gap-4 rounded-[20px] border-2 border-[var(--border)] bg-[var(--surface)] p-[18px]">
                                <div className="h-11 w-11 shrink-0 rounded-xl bg-[var(--surface-muted)]" />
                                <div className="grid min-w-0 flex-1 gap-2">
                                    <div className="h-6 w-56 max-w-full rounded bg-[var(--surface-muted)]" />
                                    <div className="h-5 w-40 max-w-full rounded bg-[var(--surface-muted)]" />
                                    <div className="h-5 w-32 max-w-full rounded bg-[var(--surface-muted)]" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
