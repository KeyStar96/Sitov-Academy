/**
 * Registration Loading Skeleton
 * 
 * Next.js App Router shows this instantly while the registration page
 * fetches data from Supabase (courses, exceptions). Matches the visual
 * structure of EnrollmentTerminal for a seamless experience.
 */
export default function RegistrationLoading() {
    return (
        <div className="relative w-full min-h-screen">
            <div className="relative z-10">
                <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8">
                    <div className="w-full max-w-6xl mx-auto">
                        {/* Terminal Shell Skeleton */}
                        <div className="bg-[var(--surface)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-pulse">

                            {/* Header */}
                            <div className="px-6 md:px-12 py-8">
                                <div className="flex justify-between items-start mb-6">
                                    {/* Back link */}
                                    <div className="h-3 w-16 bg-[var(--surface-muted)] rounded" />
                                    {/* Logo */}
                                    <div className="h-7 w-[100px] bg-[var(--surface-muted)] rounded" />
                                </div>

                                {/* Progress bar */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-1 h-1 bg-[var(--surface-muted)] rounded-full overflow-hidden">
                                        <div className="h-full w-1/3 bg-[var(--accent)]/20 rounded-full" />
                                    </div>
                                    <div className="h-3 w-20 bg-[var(--surface-muted)] rounded" />
                                </div>

                                {/* Title */}
                                <div className="h-10 w-64 max-w-full bg-[var(--surface-muted)] rounded-lg mb-2" />
                                <div className="h-4 w-48 max-w-full bg-[var(--surface-muted)] rounded" />
                            </div>

                            {/* Content area */}
                            <div className="px-6 md:px-12 pb-8">
                                {/* Top boxes grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                    {/* Start Date Box */}
                                    <div className="bg-[var(--surface-muted)] rounded-xl p-6 h-[200px]">
                                        <div className="h-3 w-24 bg-[var(--accent)]/20 rounded mb-4" />
                                        <div className="h-8 w-40 max-w-full bg-[var(--surface-muted)] rounded-lg mb-3" />
                                        <div className="h-4 w-32 max-w-full bg-[var(--surface-muted)] rounded" />
                                    </div>
                                    {/* Price Box */}
                                    <div className="bg-[var(--surface-muted)] rounded-xl p-6 h-[200px] flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 mb-4 rounded-full bg-[var(--surface-muted)]" />
                                        <div className="h-3 w-36 bg-[var(--surface-muted)] rounded" />
                                    </div>
                                </div>

                                {/* Course list skeleton */}
                                <div className="space-y-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className="bg-[var(--surface-muted)] rounded-xl p-4 flex flex-wrap items-center gap-3"
                                        >
                                            <div className="w-6 h-6 rounded-md bg-[var(--surface-muted)] shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="h-5 w-48 max-w-full bg-[var(--surface-muted)] rounded mb-2" />
                                                <div className="h-3 w-32 max-w-full bg-[var(--surface-muted)] rounded" />
                                            </div>
                                            <div className="h-5 w-16 bg-[var(--surface-muted)] rounded" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
