import { CourseConfig, Day, CourseException } from "@/lib/course-config";

export const DAY_MAP: Record<Day, number> = {
    "Mo": 1, "Di": 2, "Mi": 3, "Do": 4, "Fr": 5, "Sa": 6, "So": 0
};

// Helper: Minuten berechnen
export const getDurationMinutes = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
};

// Module-level constant - shared across all function calls
const LOCALE_MAP: Readonly<Record<string, string>> = {
    'de': 'de-DE',
    'en': 'en-US',
    'ru': 'ru-RU',
    'uk': 'uk-UA',
    'tu': 'tr-TR'
} as const;

export interface MonthlyStats {
    sessionCount: number;
    totalUnits: number;
    deductions: { amount: number, reason: string, date: string }[];
    monthName: string;
    targetYear: number;
    targetMonth: number;
}

// Berechnet Termine & Einheiten für einen SPEZIFISCHEN Monat
export const calculateMonthlyStats = (
    course: CourseConfig,
    lang: string,
    targetMonth: number, // 0-11
    targetYear: number,
    exceptions: CourseException[] = [], // Default to empty if not provided for now
    startDay: number = 1 // New Parameter: Start counting from this day (inclusive)
): MonthlyStats => {
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    let sessionCount = 0;
    let totalUnits = 0;
    let deductions: { amount: number, reason: string, date: string }[] = [];

    // Map sessions map for easy lookup
    const sessionsByDay = new Map<number, typeof course.sessions>();
    course.sessions.forEach(s => {
        const dIndex = DAY_MAP[s.day];
        const existing = sessionsByDay.get(dIndex) || [];
        sessionsByDay.set(dIndex, [...existing, s]);
    });

    const locale = LOCALE_MAP[lang] || 'de-DE';

    // Loop starts from startDay instead of fixed 1
    for (let d = startDay; d <= daysInMonth; d++) {
        const date = new Date(targetYear, targetMonth, d);
        // Warning: Local vs ISO/UTC handling.
        // Construction with (Y, M, D) creates local time.
        // YYYY-MM-DD generation needs to be careful.
        // padStart guarantees 2 digits.
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = date.getDay();

        if ((course.startDate && dateStr < course.startDate) || (course.endDate && dateStr > course.endDate)) continue;

        const sessionsToday = sessionsByDay.get(dayOfWeek);
        if (sessionsToday) {
            sessionsToday.forEach(s => {
                const mins = getDurationMinutes(s.startTime, s.endTime);
                const units = mins / (course.unitDuration || 45);
                const cost = units * course.price;

                // Check for exception
                const exception = exceptions.find(e =>
                    e.date === dateStr && (!e.courseIds || e.courseIds.includes(course.id))
                );

                if (exception) {
                    deductions.push({
                        amount: cost,
                        reason: exception.reason,
                        date: date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
                    });
                } else {
                    sessionCount++;
                    totalUnits += units;
                }
            });
        }
    }

    let monthName = new Date(targetYear, targetMonth, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
    if (['ru', 'uk'].includes(lang)) {
        monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    }

    return {
        sessionCount,
        totalUnits,
        deductions,
        monthName,
        targetYear,
        targetMonth
    };
};

// Generates the next 6 months starting from next month
export const getNext6Months = (lang: string, referenceDate?: Date) => {
    const months = [];
    const today = referenceDate || new Date();
    // Start from next month
    let currentMonth = today.getMonth() + 1;
    let currentYear = today.getFullYear();

    const locale = LOCALE_MAP[lang] || 'de-DE';

    for (let i = 0; i < 6; i++) {
        // Handle year rollover
        const y = currentMonth > 11 ? currentYear + Math.floor(currentMonth / 12) : currentYear;
        const m = currentMonth % 12;

        let label = new Date(y, m, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
        if (['ru', 'uk'].includes(lang)) {
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }

        months.push({
            value: `${m}-${y}`, // Format: "0-2026" (Jan 2026)
            label: label,
            month: m,
            year: y
        });

        currentMonth++;
    }
    return months;
};
