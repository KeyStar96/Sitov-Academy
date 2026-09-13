"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import germanDictionary from "@/dictionaries/de.json";

export type RegistrationDictionary = Pick<typeof germanDictionary, "registration" | "timetable" | "academy">;
import type { CourseSelection } from "@/lib/course-selection";
import { CourseConfig, CourseException } from "@/lib/course-config";
import { calculateMonthlyStats } from "@/lib/course-calculations";

interface PricingRoadmapProps {
    dictionary: RegistrationDictionary;
    lang: string;
    startDate: string;
    selectedCourses: CourseConfig[];
    courseSelections: CourseSelection[];
    currentMonthPrice: number;
    exceptions?: CourseException[];
    onShowPaymentInfo?: () => void;
}

export default function PricingRoadmap({
    dictionary,
    lang,
    startDate,
    selectedCourses,
    courseSelections,
    currentMonthPrice,
    exceptions = [],
    onShowPaymentInfo
}: PricingRoadmapProps) {
    const reducedMotion = useReducedMotion();
    // Translation shortcuts
    const t = dictionary?.registration?.pricing_roadmap ?? germanDictionary.registration.pricing_roadmap;

    // Format price helper
    const formatPrice = (price: number) =>
        new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);

    // Locale mapping for date formatting
    const localeMap: Record<string, string> = {
        'de': 'de-DE',
        'en': 'en-US',
        'ru': 'ru-RU',
        'uk': 'uk-UA',
        'tr': 'tr-TR'
    };
    const localeTag = localeMap[lang] || 'de-DE';

    // Parse start date
    const [d, m, y] = startDate.split('.').map(Number);
    const startDateObj = new Date(y, m - 1, d);

    // Calculate current month label
    const currentMonthLabel = new Intl.DateTimeFormat(localeTag, {
        month: 'long',
        year: 'numeric'
    }).format(startDateObj);

    // Calculate future months (next 2)
    const futureMonths = React.useMemo(() => {
        if (!d || !m || !y || selectedCourses.length === 0) return [];

        const months = [];
        for (let i = 1; i <= 2; i++) {
            const futureDate = new Date(y, m - 1 + i, 1);
            const monthLabel = new Intl.DateTimeFormat(localeTag, {
                month: 'long',
                year: 'numeric'
            }).format(futureDate);

            // Calculate full month price
            const cost = selectedCourses.reduce((acc, course) => {
                const stats = calculateMonthlyStats(
                    course,
                    lang,
                    futureDate.getMonth(),
                    futureDate.getFullYear(),
                    exceptions,
                    1,
                    courseSelections.find(selection=>selection.courseId===course.id)?.requestedUnits ?? 1
                );
                return acc + (stats.totalUnits * course.unitPrice);
            }, 0);

            months.push({ label: monthLabel, cost });
        }
        return months;
    }, [selectedCourses, courseSelections, lang, startDate, exceptions, d, m, y, localeTag]);

    // Don't render if no courses selected
    if (selectedCourses.length === 0) return null;

    return (
        <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            className="enrollment-pricing flex h-full min-w-0 flex-col"
        >
            <div className="min-w-0 flex-1">
                <div className="enrollment-pricing-current">
                    <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                        <Check size={15} aria-hidden="true" />{t.due_today}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                        <span className="min-w-0 text-base font-medium text-[var(--foreground)]">{currentMonthLabel}</span>
                        <span className="text-2xl font-semibold tracking-tight text-[var(--accent)] tabular-nums">{formatPrice(currentMonthPrice)}</span>
                    </div>
                </div>
                <div className="my-4 h-px bg-[var(--border)]" />
                <div className="mb-4 space-y-4">
                    {futureMonths.map((month, idx) => (
                        <div key={idx} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[var(--foreground)]">{month.label}</p>
                                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{t.optional_continuation}</p>
                            </div>
                            <span className="text-sm font-semibold text-[var(--foreground)] tabular-nums">{formatPrice(month.cost)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                    <Check size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    <span className="text-xs font-medium leading-relaxed text-[var(--foreground)]">{t.cancel_anytime}</span>
                </div>
            </div>
        </motion.div>
    );
}
