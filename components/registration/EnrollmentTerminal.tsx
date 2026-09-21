"use client";
import CourseQuantityInput from './CourseQuantityInput';
import { formatCourseQuantity } from '@/lib/course-quantity-i18n';
import type { CourseSelection } from '@/lib/course-selection';
import { courseText } from '@/lib/business-courses';

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import BrandLogo from "@/components/layout/BrandLogo";
import Link from "next/link";
import { ChevronLeft, Check, X, ArrowRight, Loader2, MapPin, Monitor, User, ChevronDown, ArrowLeft, CheckCircle2, Gift, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { CourseConfig, Day, CourseException, CourseSession } from "@/lib/course-config";
import { calculateMonthlyStats, getDurationMinutes, DAY_MAP, getNext6Months } from "@/lib/course-calculations";
import { createSchema, EnrollmentFormData } from "@/lib/registration-schema";
import PricingRoadmap, { type RegistrationDictionary } from "@/components/registration/PricingRoadmap";
import germanDictionary from "@/dictionaries/de.json";
import "./registration.css";
import { DateDropdowns } from "@/components/ui/DateDropdowns";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { submitEnrollment } from "@/app/actions/submit-enrollment";
import { submitTrialLesson } from "@/app/actions/submit-trial";
import { trialEligibilityHint } from "@/app/actions/trialEligibilityHint";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";
import EnrollmentSignup from './EnrollmentSignup';

// Use the CSS variable --font-sans tabular-nums from layout.tsx instead of re-instantiating
const monoClassName = "font-sans tabular-nums";

// --- TYPE INTERFACES ---
interface MaskedDateInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
    error?: string;
    required?: boolean;
    referenceDate?: Date;
}

interface CourseRowProps {
    course: CourseConfig;
    selected: boolean;
    onToggle: () => void;
    title: string;
    priceFormatted: string;
    level?: string;
    dictionary: RegistrationDictionary;
}

interface TerminalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    registration?: ReturnType<ReturnType<typeof useForm>['register']>;
    isDimmed?: boolean;
}

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    error?: string;
    required?: boolean;
    countryCodeLabel: string;
}


const MaskedDateInput = ({
    value,
    onChange,
    placeholder = "DD.MM.YYYY",
    label,
    error,
    required,
    referenceDate
}: MaskedDateInputProps) => {
    // ... existing MaskedDateInput code ...
    const defaultPlaceholder = placeholder;

    // Internal state to manage cursor and display
    const [displayVal, setDisplayVal] = useState(value || defaultPlaceholder);

    useEffect(() => {
        // Prepare initial value if empty or partial
        if (!value) {
            setDisplayVal(defaultPlaceholder);
        } else {
            // Overlay existing value onto placeholder
            let result = "";
            let valIdx = 0;
            for (let i = 0; i < defaultPlaceholder.length; i++) {
                if (valIdx < value.length && /\d/.test(value[valIdx])) {
                    // If char at i in placeholder is a separator, keep it and don't advance valIdx
                    if (/[^a-zA-Z0-9]/.test(defaultPlaceholder[i])) {
                        result += defaultPlaceholder[i];
                    } else {
                        result += value[valIdx];
                        valIdx++;
                    }
                } else if (/[^a-zA-Z0-9]/.test(defaultPlaceholder[i])) {
                    result += defaultPlaceholder[i];
                } else {
                    result += defaultPlaceholder[i]; // Placeholder char
                }
            }
            setDisplayVal(result);
        }
    }, [value, defaultPlaceholder]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputVal = e.target.value;
        const lastVal = displayVal;

        let cursor = e.target.selectionStart || 0;
        let digits = inputVal.replace(/\D/g, '');

        // --- STRICT VALIDATION LOGIC ---
        // We accumulate digits and validate chunks
        // Chunks: Day (2), Month (2), Year (4)

        let validDigits = "";

        // Day
        let day = "";
        if (digits.length > 0) day += digits[0];
        if (digits.length > 1) day += digits[1];

        if (day.length === 1 && parseInt(day) > 3) day = "0" + day; // Auto 0 prefix logic? Or strict limit? User said "01-31".
        // Strict limit: If first digit > 3, reject? Or allow? 
        // User wants "control". Let's stick strictly to range.

        if (day.length === 2) {
            const d = parseInt(day);
            if (d < 1 || d > 31) {
                // Invalid day, keep only valid part or nothing? 
                // Let's truncate to last valid length.
                day = day.slice(0, 1);
            }
        }
        validDigits += day;

        // Month
        let month = "";
        if (digits.length > 2) month += digits[2];
        if (digits.length > 3) month += digits[3];

        if (month.length === 2) {
            const m = parseInt(month);
            if (m < 1 || m > 12) {
                month = month.slice(0, 1);
            }
        }
        validDigits += month;

        // Year
        let year = "";
        if (digits.length > 4) year = digits.slice(4, 8);

        if (year.length === 4) {
            const y = parseInt(year);
            const currentYear = new Date(referenceDate || new Date()).getFullYear();
            if (y < 1900 || y > currentYear) {
                year = year.slice(0, 3);
            }
        }
        validDigits += year;

        // --- Reconstruct Display ---
        let result = "";
        let dIdx = 0;
        for (let i = 0; i < defaultPlaceholder.length; i++) {
            const pChar = defaultPlaceholder[i];
            if (/[^a-zA-Z0-9]/.test(pChar)) {
                result += pChar;
            } else {
                if (dIdx < validDigits.length) {
                    result += validDigits[dIdx];
                    dIdx++;
                } else {
                    result += pChar;
                }
            }
        }

        // Call Parent with CLEAN format DD.MM.YYYY (digits with dots) if complete, or partial?
        // Zod expects text string. Parent expects `onChange` with event or string.
        // We should trigger onChange with the MASKED value or RAW?
        // Let's adhere to DD.MM.YYYY standard output.

        onChange(result);

        // Need to restore cursor position? React handles this poorly with formatted inputs.
        // This is complex. For now, simple update.
    };

    return (
        <TerminalInput
            label={label}
            required={required}
            value={displayVal}
            onChange={handleChange}
            error={error}
            maxLength={10}
            // Logic to select text on focus so user can start typing immediately replacing placeholder?
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                if (displayVal === defaultPlaceholder) {
                    // Move cursor to start
                    e.target.setSelectionRange(0, 0);
                }
            }}
        />
    );
};

// --- ZOD SCHEMA ---


// --- COMPONENT: ROW (PAPER OPTIK) ---

const CourseRow = React.memo(({ course, selected, onToggle, title, priceFormatted, level, dictionary }: CourseRowProps) => {
    const t = dictionary?.registration?.course_card;
    const daysDict = dictionary?.timetable?.days;
    const timetableLabels = dictionary?.timetable?.labels;
    const isPrivate = course.category === 'private';

    return (
        <motion.div
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); }
            }}
            layout
            className={cn(
                "enrollment-course group relative w-full min-w-0 cursor-pointer rounded-2xl border p-4 text-left sm:p-5",
                selected ? "enrollment-course-selected" : isPrivate ? "enrollment-course-private" : ""
            )}
        >
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* 1. Top Row: Checkbox + Title (Left) / Price (Right) */}
                <div className="flex min-w-0 flex-1 items-start w-full md:w-auto justify-between md:justify-start">

                    {/* Left: Checkbox + Title Group */}
                    <div className="flex min-w-0 items-start">
                        {/* Checkbox */}
                        <div className={cn(
                            "w-5 h-5 shrink-0 rounded border mr-3 md:mr-3 flex items-center justify-center transition-all duration-300 mt-1 md:mt-0",
                            selected
                                ? "bg-[var(--accent)] border-[var(--accent)]"
                                : "bg-transparent border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40"
                        )}>
                            {selected && <Check size={12} className="text-[var(--accent-foreground)]" strokeWidth={3} />}
                        </div>

                        {/* Title & Metadata Container */}
                        <div className="flex min-w-0 flex-col gap-1 md:gap-2">
                            {/* Title */}
                            <span className={cn(
                                "font-sans text-base md:text-lg font-semibold tracking-tight transition-colors break-words pr-2",
                                selected ? "text-[var(--accent-text)]" : "text-[var(--foreground)]"
                            )}>
                                {title}
                            </span>

                            {/* Mobile: Metadata Row (Left Aligned under title) */}
                            <div className="flex flex-wrap items-center gap-2 md:hidden">
                                {level && (
                                    <span className="text-xs font-sans tabular-nums bg-white dark:bg-[var(--accent)] border border-black/10 dark:border-[var(--accent)] px-1.5 py-0.5 rounded text-[var(--foreground)] dark:text-[var(--accent-foreground)]">
                                        {level}
                                    </span>
                                )}
                                <span className={cn(
                                    "font-sans tabular-nums text-xs flex items-center gap-1",
                                    course.type === 'online' ? "text-[var(--violet)]" : "text-gray-500"
                                )}>
                                    {course.type === 'online' ? <Monitor size={10} /> : <MapPin size={10} />}
                                    {course.type === 'online' ? (t?.online_label || germanDictionary.registration.course_card.online_label).toUpperCase() : (t?.presence_label || germanDictionary.registration.course_card.presence_label)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Price (Mobile Only - moved up) */}
                    <div className="text-right shrink-0 md:hidden pl-2">
                        <div className="font-sans tabular-nums text-sm text-[var(--foreground)] font-semibold">{priceFormatted}</div>
                        <div className="text-gray-400 text-xs">{dictionary.academy.course_unit.replace('{minutes}', String(course.unitMinutes))}</div>
                    </div>
                </div>

                {/* Desktop: Middle Meta Column (Hidden on Mobile) */}
                <div className="hidden md:flex items-center gap-4 w-full md:w-auto">
                    {/* Badge */}
                    <div className="w-[60px] flex items-center shrink-0">
                        {level && (
                            <span className="text-xs font-sans tabular-nums bg-white dark:bg-[var(--accent)] border border-black/10 dark:border-[var(--accent)] px-1.5 py-0.5 rounded text-[var(--foreground)] dark:text-[var(--accent-foreground)]">
                                {level}
                            </span>
                        )}
                    </div>

                    {/* Type */}
                    <span className={cn(
                        "font-sans tabular-nums text-xs flex items-center gap-2 shrink-0",
                        course.type === 'online' ? "text-[var(--violet)]" : "text-gray-500"
                    )}>
                        {course.type === 'online' ? <Monitor size={12} /> : <MapPin size={12} />}
                        {course.type === 'online' ? (t?.online_label || germanDictionary.registration.course_card.online_label).toUpperCase() : (t?.presence_label || germanDictionary.registration.course_card.presence_label)}
                    </span>
                </div>

                {/* Desktop: Price (Hidden on Mobile) */}
                <div className="hidden md:block text-right pl-9 md:pl-0 w-full md:w-auto shrink-0">
                    <span className="font-sans tabular-nums text-sm text-[var(--foreground)] font-semibold">{priceFormatted} <span className="text-gray-400 text-xs font-normal">{dictionary.academy.course_unit.replace('{minutes}', String(course.unitMinutes))}</span></span>
                </div>
            </div>

            {/* Expanded Details when selected */}
            <div className="relative z-10 flex flex-wrap gap-x-3 gap-y-1 mt-3 pl-8">
                {course.sessions.map((s: CourseSession, i: number) => {
                    // Properly access day properties
                    const shortWeekdays: Record<string, string> = {
                        "mo": daysDict?.mo || germanDictionary.timetable.days.mo,
                        "di": daysDict?.di || germanDictionary.timetable.days.di,
                        "mi": daysDict?.mi || germanDictionary.timetable.days.mi,
                        "do": daysDict?.do || germanDictionary.timetable.days.do,
                        "fr": daysDict?.fr || germanDictionary.timetable.days.fr,
                        "sa": daysDict?.sa || germanDictionary.timetable.days.sa,
                        "so": daysDict?.so || germanDictionary.timetable.days.so
                    };
                    const dayKey = s.day.toLowerCase() as keyof typeof shortWeekdays;

                    return (
                        <span key={i} className="text-xs font-sans tabular-nums text-gray-400">
                            {shortWeekdays[dayKey] || s.day} {s.startTime}
                        </span>
                    );
                })}
            </div>
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.title === nextProps.title &&
        prevProps.priceFormatted === nextProps.priceFormatted &&
        prevProps.level === nextProps.level &&
        prevProps.course.id === nextProps.course.id
    );
});

const TerminalInput = ({ label, error, registration, isDimmed, ...props }: TerminalInputProps) => {
    const defaultId = React.useId();
    const id = props.id || registration?.name || defaultId;
    return (
        <div className={cn("enrollment-field relative group", isDimmed ? "opacity-30" : "opacity-100")}>
            <input
                id={id}
                {...registration}
                {...props}
                placeholder=" "
                className={cn(
                    "block w-full bg-transparent border-b border-gray-400/30 dark:border-white/20 py-4 pt-6 text-lg font-sans text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] dark:focus:border-[var(--accent)] transition-colors peer placeholder-transparent autofill:bg-transparent",
                    // Force transparent background for autofill and adjust text color
                    "[&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_100px_#FCF4E6_inset] dark:[&:-webkit-autofill]:shadow-[0_0_0_100px_#1A1C1E_inset]",
                    "[&:-webkit-autofill]:[-webkit-text-fill-color:#111827] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:#E2D7CE]",
                    error && "border-red-500 dark:border-red-400"
                )}
            />
            <label
                htmlFor={id}
                className={cn(
                    "absolute left-0 top-0 text-xs tracking-normal text-[var(--muted)] transition-all pointer-events-none",
                    monoClassName,
                    "peer-placeholder-shown:top-5 peer-placeholder-shown:text-lg peer-placeholder-shown:normal-case peer-placeholder-shown:font-sans peer-placeholder-shown:text-gray-500 dark:peer-placeholder-shown:text-gray-500",
                    "peer-focus:top-0 peer-focus:text-xs peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-[var(--accent-text)]",
                    monoClassName
                )}>
                {label} {props.required && <span className="text-[var(--accent-text)]">*</span>}
            </label>
            {error && <span className={cn("text-red-500 dark:text-red-400 text-xs absolute right-0 top-2", monoClassName)}>{error}</span>}
        </div>
    );
};





const COUNTRY_CODES = [
    { value: "+49", label: "🇩🇪 +49" },
    { value: "+43", label: "🇦🇹 +43" },
    { value: "+41", label: "🇨🇭 +41" },
    { value: "+44", label: "🇬🇧 +44" },
    { value: "+1", label: "🇺🇸 +1" },
    { value: "+7", label: "🇷🇺 +7" },
    { value: "+90", label: "🇹🇷 +90" },
    { value: "+380", label: "🇺🇦 +380" },
    { value: "+33", label: "🇫🇷 +33" },
    { value: "+34", label: "🇪🇸 +34" },
    { value: "+39", label: "🇮🇹 +39" },
    { value: "+48", label: "🇵🇱 +48" },
];

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    error?: string;
    required?: boolean;
    isDimmed?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}

const PhoneInput = ({
    value,
    onChange,
    label,
    countryCodeLabel,
    error,
    required,
    ...props
}: PhoneInputProps) => {
    // Value format: "+49 12345678" or just "12345678" (if no code selected yet, though we default to DE)
    // We split by space if we assume "Code Number" format. 
    // BUT user might have pasted full number. 
    // Let's manage simple state: Code + Number.
    // If value comes in, try to detect code.

    // Default to +49 if empty
    const [code, setCode] = useState("+49");
    const [number, setNumber] = useState("");

    // Initialize from value prop if present
    useEffect(() => {
        if (value) {
            // Try to find matching code
            const foundCode = COUNTRY_CODES.find(c => value.startsWith(c.value));
            if (foundCode) {
                setCode(foundCode.value);
                setNumber(value.slice(foundCode.value.length).trim());
            } else {
                setNumber(value);
            }
        }
    }, [value]);

    const updateValue = (newCode: string, newNumber: string) => {
        setCode(newCode);
        setNumber(newNumber);
        if (newNumber) {
            onChange(`${newCode} ${newNumber}`);
        } else {
            onChange(""); // Clear if empty number?
        }
    };

    return (
        <div className={cn("enrollment-phone relative group z-30", props.isDimmed ? "opacity-30" : "opacity-100")}>
            <span className={cn(
                "absolute left-0 top-0 text-xs tracking-normal text-[var(--accent-text)] transition-all",
                monoClassName,
                // Always visible label
            )}>
                {label} {required && <span>*</span>}
            </span>

            <div className="flex min-w-0 gap-2 pt-6">
                <div className="relative w-[104px] shrink-0">
                    <select
                        aria-label={countryCodeLabel}
                        autoComplete="tel-country-code"
                        value={code}
                        onChange={event => updateValue(event.target.value, number)}
                        onFocus={props.onFocus}
                        onBlur={props.onBlur}
                        className="enrollment-country-code"
                    >
                        {COUNTRY_CODES.map(country => (
                            <option key={country.value} value={country.value}>{country.label}</option>
                        ))}
                    </select>
                </div>

                <div className="relative min-w-0 flex-1">
                    <input
                        type="tel"
                        aria-label={label}
                        autoComplete="tel-national"
                        value={number}
                        onChange={(e) => updateValue(code, e.target.value)}
                        onFocus={props.onFocus}
                        onBlur={props.onBlur}
                        className={cn(
                            "block w-full bg-transparent border-b border-gray-400/30 dark:border-white/20 py-4 text-lg font-sans text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] dark:focus:border-[var(--accent)] transition-colors placeholder-gray-300 autofill:bg-transparent",
                            "[&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-[0_0_0_100px_#FCF4E6_inset] dark:[&:-webkit-autofill]:shadow-[0_0_0_100px_#1A1C1E_inset]",
                            "[&:-webkit-autofill]:-webkit-text-fill-color-[#111827] dark:[&:-webkit-autofill]:-webkit-text-fill-color-[#E2D7CE]"
                        )}
                    />
                </div>
            </div>
            {error && <span className={cn("text-red-500 text-xs absolute right-0 top-2", monoClassName)}>{error}</span>}
        </div>
    );
};

// submitEnrollment import moved to top of file

// --- MAIN TERMINAL ---

export default function EnrollmentTerminal({ dictionary, lang = "de", serverTime, courses, exceptions = [] }: {
    dictionary: RegistrationDictionary,
    lang: string,
    serverTime?: number,
    courses: CourseConfig[],
    exceptions?: CourseException[]
}) {
    const searchParams = useSearchParams();
    const reducedMotion = useReducedMotion();
    const initialCourseId = searchParams.get("courseId");
    const isTrialMode = searchParams.get("trial") === "1";

    // Translation Shortcuts
    const t = dictionary?.registration;
    const trialT = t?.trial;
    const formLabels = t?.form;
    const wizard = t?.wizard;
    const success = t?.success;
    const receipt = t?.receipt;
    const groupTitles = t?.group_titles;

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [requestedUnits, setRequestedUnits] = useState<Record<string,number>>({});
    const courseSelections: CourseSelection[] = selectedCourseIds.map(courseId=>({courseId,...(courses.find(course=>course.id===courseId)?.category==='private'?{requestedUnits:requestedUnits[courseId]??1}:{})}));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);
    const [showPaymentInfo, setShowPaymentInfo] = useState(false);
    
    // Focus State for Cinematic UI
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // Premium Animations
    const stepVariants = reducedMotion ? {
        initial: { opacity: 1, y: 0, filter: "none" },
        animate: { opacity: 1, y: 0, filter: "none", transition: { duration: 0 } },
        exit: { opacity: 1, y: 0, filter: "none", transition: { duration: 0 } },
    } : {
        initial: { opacity: 0, y: 40, filter: "blur(10px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const } },
        exit: { opacity: 0, y: -40, filter: "blur(10px)", transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } }
    };

    // --- TRIAL MODE STATE ---
    const [trialDate, setTrialDate] = useState<string>(""); // ISO YYYY-MM-DD
    const [trialEligible, setTrialEligible] = useState<boolean | null>(null); // null = not checked
    const [trialCheckLoading, setTrialCheckLoading] = useState(false);

    // Compute the selected trial course (from selectedCourseIds, so it updates when user switches)
    const trialCourse = React.useMemo(() => {
        if (!isTrialMode) return null;
        const cid = selectedCourseIds[0];
        if (!cid) return null;
        return (courses || []).find(c => c.id === cid) || null;
    }, [isTrialMode, selectedCourseIds, courses]);

    // Reset trialDate when course changes
    useEffect(() => {
        if (isTrialMode) setTrialDate("");
    }, [selectedCourseIds[0]]);



    const trialDates = React.useMemo(() => {
        if (!trialCourse) return [];
        const dayMap: Record<string, number> = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 0 };
        const sessionDays = trialCourse.sessions.map(s => dayMap[s.day]);
        const dates: { date: Date; label: string; iso: string }[] = [];
        const today = new Date(serverTime ?? Date.now());
        today.setHours(0, 0, 0, 0);
        const daysDict = dictionary?.timetable?.days;
        const dayNames: Record<string, string> = {
            0: daysDict?.so || germanDictionary.timetable.days.so,
            1: daysDict?.mo || germanDictionary.timetable.days.mo,
            2: daysDict?.di || germanDictionary.timetable.days.di,
            3: daysDict?.mi || germanDictionary.timetable.days.mi,
            4: daysDict?.do || germanDictionary.timetable.days.do,
            5: daysDict?.fr || germanDictionary.timetable.days.fr,
            6: daysDict?.sa || germanDictionary.timetable.days.sa,
        };
        for (let i = 1; i <= 60; i++) { // Look ahead up to 60 days
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            if (sessionDays.includes(d.getDay())) {
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if ((trialCourse.startDate && iso < trialCourse.startDate) ||
                    (trialCourse.endDate && iso > trialCourse.endDate) ||
                    exceptions.some(exception => exception.date === iso &&
                        (!exception.courseIds || exception.courseIds.includes(trialCourse.id)))) continue;
                const dayName = dayNames[d.getDay()];
                const label = `${dayName}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
                dates.push({ date: d, label, iso });
                if (dates.length >= 8) break; // Only show next 8 sessions
            }
        }
        return dates;
    }, [trialCourse, dictionary, exceptions, serverTime]);

    useEffect(() => {
        setTrialDate(current => current && !trialDates.some(date => date.iso === current) ? "" : current);
    }, [trialDates]);

    // Dynamic Start Date (Default: Tomorrow)
    const [startDate, setStartDate] = useState(() => {
        const d = serverTime ? new Date(serverTime) : new Date();
        d.setDate(d.getDate() + 1); // Earliest is tomorrow
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    });

    // Derived Start Date Object
    const startDateObj = React.useMemo(() => {
        const [d, m, y] = startDate.split('.').map(Number);
        // Valid check
        if (!d || !m || !y) return new Date();
        return new Date(y, m - 1, d);
    }, [startDate]);

    // Push startDate forward if a selected course starts later
    useEffect(() => {
        if (selectedCourseIds.length === 0) return;
        const selected = (courses || []).filter(c => selectedCourseIds.includes(c.id));
        let maxStartDate = new Date(0);
        let hasStartDate = false;

        selected.forEach(c => {
            if (c.startDate) {
                const sDate = new Date(c.startDate);
                if (sDate > maxStartDate) {
                    maxStartDate = sDate;
                    hasStartDate = true;
                }
            }
        });

        if (hasStartDate && startDateObj < maxStartDate) {
            const day = String(maxStartDate.getDate()).padStart(2, '0');
            const month = String(maxStartDate.getMonth() + 1).padStart(2, '0');
            const year = maxStartDate.getFullYear();
            setStartDate(`${day}.${month}.${year}`);
        }
    }, [selectedCourseIds, courses, startDateObj]);

    // Grouping Logic - MEMOIZED
    const { presenceCourses, onlineCourses, speechCourses } = React.useMemo(() => {
        const sourceData = courses || [];
        const filteredData = [...(isTrialMode ? sourceData.filter(c => c.trialLessons !== false) : sourceData)].sort((a,b)=>(a.sortOrder??100)-(b.sortOrder??100));
        return {
            presenceCourses: filteredData.filter(c => c.type === 'presence' && c.category !== 'speaking'),
            onlineCourses: filteredData.filter(c => c.type === 'online'),
            speechCourses: filteredData.filter(c => c.category === 'speaking')
        };
    }, [courses, isTrialMode]);

    // Label for current selection
    const localeMap: Record<string, string> = {
        'de': 'de-DE',
        'en': 'en-US',
        'ru': 'ru-RU',
        'uk': 'uk-UA',
        'tr': 'tr-TR'
    };
    const localeTag = localeMap[lang] || 'de-DE';

    // Capitalize first letter for months in languages where it might be lowercase (though standard locales usually handle this)
    const currentMonthLabel = startDateObj.toLocaleString(localeTag, { month: 'long', year: 'numeric' });

    const enrollmentSchema = React.useMemo(() => createSchema(dictionary), [dictionary]);
    const form = useForm<EnrollmentFormData>({
        resolver: zodResolver(enrollmentSchema),
        mode: "onChange"
    });
    const { register, handleSubmit, formState: { errors, isValid }, trigger, watch, setValue, getValues } = form;
    const formData = watch("personal");
    const zipCode = watch("personal.zip");

    // --- ZIP CODE AUTO-FILL ---
    useEffect(() => {
        // Only trigger if we have exactly 5 digits
        if (zipCode && zipCode.length === 5 && /^\d+$/.test(zipCode)) {
            const fetchCity = async () => {
                try {
                    const response = await fetch(`https://api.zippopotam.us/de/${zipCode}`);
                    if (!response.ok) return; // Silent fail
                    const data = await response.json();
                    if (data && data.places && data.places.length > 0) {
                        const city_name = data.places[0]["place name"];
                        // If user hasn't typed a city yet (or we just want to help), fill it.
                        // Standard UX: If it's empty, fill it. If it's different, maybe don't overwrite?
                        // User request: "Fill it... user can edit if wrong". Overwriting is often expected behavior for ZIP autofill.
                        // Let's check if the current city is empty or different.
                        // Ideally, we just set it. The user sees it change.
                        setValue("personal.city", city_name, { shouldValidate: true });
                    }
                } catch (e) {
                    // Ignore network errors, silent fail
                }
            };
            fetchCity();
        }
    }, [zipCode, setValue]);

    useEffect(() => {
        if (initialCourseId && !selectedCourseIds.includes(initialCourseId) && courses?.some(c => c.id === initialCourseId)) {
            setSelectedCourseIds([initialCourseId]);
        }
    }, [initialCourseId, courses]);

    const toggleCourse = React.useCallback((id: string) => {
        if (isTrialMode) {
            // Trial mode: single select only
            setSelectedCourseIds(prev => prev.includes(id) ? [] : [id]);
        } else {
            setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
        }
    }, [isTrialMode]);

    const getCourseData = React.useCallback((c: CourseConfig) => {
        // Calculate price based on selected month
        // Note: For the CARD DISPLAY, user wants "Price per Unit".
        // The Monthly Total is calculated separately in `totalMonthlyPrice`.
        return {
            title: courseText(c, lang).title,
            priceFormatted: isTrialMode ? (trialT?.price_label || germanDictionary.registration.trial.price_label) : new Intl.NumberFormat(lang === 'en' ? 'de-DE' : 'de-DE', { style: 'currency', currency: 'EUR' }).format(c.unitPrice),
            level: c.level,
            dictionary // Pass dictionary down
        };
    }, [dictionary, lang, isTrialMode, trialT]);

    const selectedCoursesFull = (courses || []).filter(c => selectedCourseIds.includes(c.id));

    // Dynamic Total Calculation - MEMOIZED
    const totalMonthlyPrice = React.useMemo(() => {
        const [d, m, y] = startDate.split('.').map(Number);
        if (!d || !m || !y) return 0;

        return selectedCoursesFull.reduce((acc, c) => {
            // Pass startDay (d) for the first month
            const stats = calculateMonthlyStats(c, lang, m - 1, y, exceptions, d, requestedUnits[c.id]??1);
            const units = stats.totalUnits;
            return acc + (units * c.unitPrice);
        }, 0);
    }, [selectedCoursesFull, lang, startDate, exceptions, requestedUnits]);

    // Auto-advance start date if no sessions are left in the selected month
    React.useEffect(() => {
        if (isTrialMode || selectedCoursesFull.length === 0) return;

        const [d, m, y] = startDate.split('.').map(Number);
        if (!d || !m || !y) return;

        let totalUnitsRemaining = 0;
        selectedCoursesFull.forEach(c => {
            const stats = calculateMonthlyStats(c, lang, m - 1, y, exceptions, d, requestedUnits[c.id]??1);
            totalUnitsRemaining += stats.totalUnits;
        });

        // If no units left, and we aren't already on the 1st (avoid infinite loops for dead months), shift to the 1st of next month
        if (totalUnitsRemaining === 0 && d !== 1) {
            let nextM = m + 1;
            let nextY = y;
            if (nextM > 12) {
                nextM = 1;
                nextY++;
            }
            const newDate = `01.${String(nextM).padStart(2, '0')}.${nextY}`;
            setStartDate(newDate);
        }
    }, [selectedCoursesFull, lang, startDate, exceptions, isTrialMode, requestedUnits]);

    const formatPrice = React.useCallback((p: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p), []);

    // Step navigation and the mobile shortcut use the document's native scroll.
    // The desktop receipt is positioned entirely by CSS; it never observes scroll.
    const footerRef = React.useRef<HTMLDivElement>(null);
    const [showScrollHint, setShowScrollHint] = useState(false);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
    }, [step]);

    useEffect(() => {
        const mobileViewport = window.matchMedia("(max-width: 1023px)");
        let observer: IntersectionObserver | undefined;

        const observeMobileSummary = () => {
            observer?.disconnect();
            setShowScrollHint(false);

            if (!mobileViewport.matches || !footerRef.current) return;

            observer = new IntersectionObserver(
                ([entry]) => setShowScrollHint(!entry.isIntersecting),
                { threshold: 0.1 }
            );
            observer.observe(footerRef.current);
        };

        observeMobileSummary();
        mobileViewport.addEventListener("change", observeMobileSummary);

        return () => {
            observer?.disconnect();
            mobileViewport.removeEventListener("change", observeMobileSummary);
        };
    }, []);

    const scrollToBottom = () => {
        footerRef.current?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
    };

    // --- LEGAL CONSENTS ---
    const [consents, setConsents] = useState({
        privacy: false,
        agb: false,
        revocation: false,
        videoRecording: false
    });

    // Determine if any selected course is an online course
    const hasOnlineCourse = selectedCoursesFull.some(c => c.type === 'online');

    const isLegalValid = consents.privacy && consents.agb && consents.revocation && (!hasOnlineCourse || consents.videoRecording);

    // --- DARK MODE LOGIC ---
    const [isDarkMode, setIsDarkMode] = useState(false); // Default to light until mounted check
    useEffect(() => {
        // Check localStorage or system pref
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark") setIsDarkMode(true);
        else if (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches) setIsDarkMode(true);
    }, []);

    // Also listen to class changes if Header throttles it, or just use class detection
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    setIsDarkMode(document.documentElement.classList.contains("dark"));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    // Helper for rendering legal checkboxes
    const LegalCheckbox = ({ id, label, checked, onChange }: { id: string, label: string, checked: boolean, onChange: (v: boolean) => void }) => (
        <label className="enrollment-consent flex min-h-11 items-start gap-3 cursor-pointer group mt-4 rounded-xl p-2">
            <div className="relative mt-0.5 shrink-0">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="appearance-none h-5 w-5 bg-transparent border border-gray-400 dark:border-white/30 rounded-sm checked:bg-[var(--accent)] checked:border-[var(--accent)] transition-colors"
                />
                {checked && <Check size={12} className="text-[var(--accent-foreground)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={3} />}
            </div>
            <span className="text-xs md:text-sm font-medium text-[var(--foreground)] leading-normal select-none transition-colors">
                {label}
            </span>
        </label>
    );

    // --- TRIAL SUBMIT HANDLER ---
    const onTrialSubmit = async (data: EnrollmentFormData) => {
        if (!isLegalValid) return;
        const courseId = selectedCourseIds[0];
        if (!courseId || !trialDates.some(date => date.iso === trialDate)) return;
        if (trialEligible === false) return;

        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            const result = await submitTrialLesson({
                firstName: data.personal.firstName,
                lastName: data.personal.lastName,
                email: data.personal.email,
                phone: data.personal.phone || undefined,
                birthDate: data.personal.birthDate || undefined,
                street: data.personal.street || undefined,
                zip: data.personal.zip || undefined,
                city: data.personal.city || undefined,
                courseId: courseId,
                trialDate: trialDate,
                videoRecordingAccepted: hasOnlineCourse ? consents.videoRecording : undefined,
                privacyAccepted: consents.privacy, agbAccepted: consents.agb, locale: lang,
            });

            if (result.success) {
                trackMetaEvent('Lead', {
                    content_name: 'Kostenlose Probestunde',
                    content_category: 'Trial Lesson',
                    content_ids: [courseId],
                    currency: 'EUR',
                    value: 0.00,
                });
                setIsSuccess(true);
            } else if (result.message === 'trial_already_used') {
                setIsAlreadyUsed(true);
            } else {
                alert(result.message || "Something went wrong. Please try again.");
            }
        } catch (error) {
            console.error("Trial submission error:");
            alert("Network error. Please try again.");
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const onSubmit = async (data: EnrollmentFormData) => {
        if (!isLegalValid) return; // safety check

        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);

        try {
            const result = await submitEnrollment(data, courseSelections, startDate, consents, lang);

            if (result.success) {
                trackMetaEvent('Purchase', {
                    content_name: 'Kurseinschreibung',
                    content_category: 'Course Enrollment',
                    content_ids: selectedCourseIds,
                    currency: 'EUR',
                    value: totalMonthlyPrice,
                });
                setIsSuccess(true);
            } else {
                console.error("Enrollment failed:"); // Log full result for debugging
                alert(result.message || "Something went wrong. Please try again.");
            }
        } catch (error) {
            console.error("Submission error details:");
            alert("Network error. Please try again.");
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };






    const handleNextStep = async () => {
        if (step === 1 && selectedCourseIds.length > 0) {
            // In trial mode, also require a day selection
            if (isTrialMode && !trialDate) return;
            setStep(2);
        } else if (step === 2) {
            const valid = await trigger("personal");
            if (!valid) return;

            // In trial mode, check eligibility before proceeding to step 3
            if (isTrialMode) {
                const formVals = getValues();
                setTrialCheckLoading(true);
                const { eligible } = await trialEligibilityHint(
                    formVals.personal.email,
                    formVals.personal.firstName,
                    formVals.personal.lastName
                );
                setTrialEligible(eligible);
                setTrialCheckLoading(false);
                if (!eligible) {
                    setIsAlreadyUsed(true);
                    return; // Don't proceed
                }
            }
            setStep(3);
        }
    };

    if (isAlreadyUsed) {
        return (
            <div className="registration-flow enrollment-result min-h-screen w-full flex flex-col items-center justify-center text-center p-6 font-sans">
                <div className="w-20 h-20 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] flex items-center justify-center mb-6 relative">
                    <span className="absolute -top-1 -right-1 text-xs">!</span>
                    <User size={32} />
                </div>
                <h3 className="text-3xl font-semibold mb-4 tracking-tight text-[var(--foreground)]">
                    {trialT?.already_used_title || germanDictionary.registration.trial.already_used_title}
                </h3>
                <p className="text-gray-500 text-lg mb-12 max-w-md mx-auto">
                    {trialT?.already_used_message || germanDictionary.registration.trial.already_used_message}
                </p>
                <Link href={`/${lang}`} className="enrollment-home-button inline-flex min-h-12 items-center rounded-2xl px-6 py-3 font-semibold transition-colors">
                    {t?.back_home || germanDictionary.registration.back_home}
                </Link>
            </div>
        );
    }

    if (isSuccess) {
        // Trial-specific success screen
        if (isTrialMode) {
            const selectedDateLabel = trialDates.find(d => d.iso === trialDate)?.label || trialDate;
            return (
                <div className="registration-flow enrollment-result min-h-screen w-full flex flex-col items-center justify-center text-center p-6 font-sans">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6">
                        <Gift size={40} />
                    </div>
                    <h3 className="text-3xl font-semibold mb-4 tracking-tight text-[var(--foreground)]">{trialT?.success_title || germanDictionary.registration.trial.success_title}</h3>
                    <p className="text-gray-500 text-lg mb-4 max-w-md">
                        {(trialT?.success_message || germanDictionary.registration.trial.success_message)}{" "}
                        <strong className="text-[var(--foreground)]">{formData?.email}</strong>.
                    </p>
                    <p className="text-[var(--accent-text)] font-semibold text-lg mb-12">
                        <CalendarDays size={18} className="inline mr-2" />
                        {selectedDateLabel}
                    </p>
                    <EnrollmentSignup lang={lang} name={`${formData?.firstName ?? ''} ${formData?.lastName ?? ''}`} email={formData?.email ?? ''} />
                    <Link href={`/${lang}`} className="enrollment-home-button inline-flex min-h-12 items-center rounded-2xl px-6 py-3 font-semibold transition-colors">
                        {t?.back_home}
                    </Link>
                </div>
            );
        }

        return (
            <div className="registration-flow enrollment-result min-h-screen w-full flex flex-col items-center justify-center text-center p-6 font-sans">
                <div className="w-20 h-20 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-6">
                    <Check size={40} />
                </div>
                <h3 className="text-3xl font-semibold mb-4 tracking-tight">{success?.title || germanDictionary.registration.success.title}</h3>
                <p className="text-gray-400 text-lg mb-12 max-w-md">{success?.message} <strong>{formData?.email}</strong>.</p>
                <EnrollmentSignup lang={lang} name={`${formData?.firstName ?? ''} ${formData?.lastName ?? ''}`} email={formData?.email ?? ''} />
                <Link href={`/${lang}`} className="enrollment-home-button inline-flex min-h-12 items-center rounded-2xl px-6 py-3 font-semibold transition-colors">
                    {t?.back_home}
                </Link>
            </div>
        );
    }


    return (
        <MotionConfig reducedMotion="user" transition={reducedMotion ? { duration: 0 } : undefined}>
        <div
            data-lenis-prevent
            className="registration-flow relative grid min-h-screen w-full grid-cols-1 items-start font-sans lg:grid-cols-[minmax(0,1fr)_340px] lg:pr-6 xl:grid-cols-[minmax(0,1fr)_380px]"
        >
            
            {/* SCROLL INDICATOR (Mobile Mostly) */}
            <AnimatePresence>
                {showScrollHint && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 10, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, x: "-50%" }}
                        onClick={scrollToBottom}
                        className="enrollment-scroll-link fixed bottom-4 left-1/2 z-40 flex min-h-11 items-center gap-2 rounded-full px-4 py-3 shadow-lg lg:hidden"
                    >
                        <ChevronDown size={18} aria-hidden="true" /><span className="text-sm font-semibold">{wizard?.scroll_to_summary}</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* --- LEFT PANEL: WIZARD CONTENT --- */}
            <div className="enrollment-main flex-1 flex flex-col min-h-0 min-w-0 relative w-full">

                {/* Header with Progress */}
                {/* Header with Progress */}
                <header className="enrollment-header px-4 py-6 sm:px-8 lg:px-10 shrink-0 z-10">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                        <Link href={`/${lang}`} className={cn("min-h-11 text-sm font-medium text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors flex items-center gap-2", monoClassName)}>
                            <ChevronLeft size={14} /> {t?.back_home || germanDictionary.registration.back_home}
                        </Link>
                        <div className="enrollment-brand flex min-w-0 items-center">
                            <BrandLogo name={dictionary.academy.brand_name} />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-4 mb-8">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(s => s - 1 as 1 | 2 | 3)}
                                className="enrollment-back-step flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm text-[var(--muted)]"
                            >
                                <ChevronLeft size={16} aria-hidden="true" /><span>{wizard?.back_step}</span>
                            </button>
                        )}
                        <div className="h-1 bg-[var(--surface-muted)] flex-1 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-[var(--accent)]"
                                initial={{ width: "33%" }}
                                animate={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
                                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 15 }}
                            />
                        </div>
                        <span className={cn("text-xs text-[var(--muted)]", monoClassName)}>{wizard?.step_label || germanDictionary.registration.wizard.step_label} {step} / 3</span>
                    </div>

                    {/* Trial Mode Banner */}
                    {isTrialMode && (
                        <div className="flex items-center gap-2 mb-4 bg-[var(--accent)]/10 dark:bg-[var(--accent)]/20 border border-[var(--accent)]/30 rounded-lg px-4 py-2 w-fit">
                            <Gift size={16} className="text-[var(--accent-text)]" />
                            <span className={cn("text-xs font-semibold tracking-normal text-[var(--accent-text)]", monoClassName)}>
                                {trialT?.badge || germanDictionary.registration.trial.badge}
                            </span>
                        </div>
                    )}

                    <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-[var(--foreground)] mb-2 transition-colors duration-300">
                        {isTrialMode
                            ? (trialT?.title || germanDictionary.registration.trial.title)
                            : (<>
                                {step === 1 && wizard?.step1_title}
                                {step === 2 && wizard?.step2_title}
                                {step === 3 && wizard?.step3_title}
                            </>)
                        }
                    </h1>
                    {isTrialMode
                        ? <p className="text-sm md:text-base text-[var(--muted)] max-w-xl transition-colors duration-300">{trialT?.subtitle || germanDictionary.registration.trial.subtitle}</p>
                        : (<>
                            {step === 1 && <p className="text-sm md:text-base text-[var(--muted)] max-w-xl transition-colors duration-300">{wizard?.step1_sub} <span className="text-[var(--accent-text)] font-semibold">{currentMonthLabel}</span>.</p>}
                            {step === 2 && <p className="text-sm md:text-base text-[var(--muted)] max-w-xl transition-colors duration-300">{wizard?.step2_sub}</p>}
                            {step === 3 && <p className="text-sm md:text-base text-[var(--muted)] max-w-xl transition-colors duration-300">{wizard?.step3_sub}</p>}
                        </>)
                    }
                </header>

                {/* Keep the form in document flow so the receipt shares one native scroll root. */}
                <div
                    className="enrollment-content flex-1 px-4 sm:px-8 lg:px-10 pb-8 min-h-0 min-w-0"
                >
                    {/* Full-width Content Area */}
                    <div className="max-w-4xl mx-auto">
                        <AnimatePresence mode="wait">

                            {/* STEP 1: SELECTION */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    variants={stepVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="space-y-7 py-2 relative z-10"
                                >
                                    {/* === CONTROL DECK: Top Fixed Container === */}
                                    <div className="enrollment-control-grid grid grid-cols-1 xl:grid-cols-2 gap-4 h-auto mb-6 relative z-30">

                                        {!isTrialMode ? (
                                            <>
                                                {/* LEFT BOX: Startdatum (Date Selection) */}
                                                <div className="enrollment-panel border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-4 sm:p-5 relative flex flex-col h-full overflow-hidden">
                                                    {/* Ambient Glow */}
                                                    <div aria-hidden="true" className="hidden absolute -top-24 -left-24 w-48 h-48 bg-[radial-gradient(circle,rgba(251,146,60,0.15)_0%,transparent_70%)] rounded-full pointer-events-none" />
                                                    {/* Header */}
                                                    <span className={cn("font-sans tabular-nums text-xs tracking-normal text-[var(--accent-text)] uppercase mb-0", monoClassName)}>
                                                        {formLabels?.start_date_label || germanDictionary.registration.form.start_date_label}
                                                    </span>

                                                    {/* Input Area - Centered */}
                                                    <div className="flex-1 flex items-center justify-center">
                                                        {(() => {
                                                            const now = serverTime ? new Date(serverTime) : new Date();
                                                            let minDate = new Date(now);
                                                            minDate.setDate(minDate.getDate() + 1);
                                                            minDate.setHours(0, 0, 0, 0);
                                                            
                                                            selectedCoursesFull.forEach(course => {
                                                                if (course.startDate) {
                                                                    const [d, m, y] = course.startDate.split('.').map(Number);
                                                                    // Format in JSON might be YYYY-MM-DD or DD.MM.YYYY, assuming DD.MM.YYYY based on app context
                                                                    let cDate = new Date(course.startDate);
                                                                    if (d && m && y && String(y).length === 4) {
                                                                        cDate = new Date(y, m - 1, d);
                                                                    }
                                                                    cDate.setHours(0,0,0,0);
                                                                    if (cDate > minDate) {
                                                                        minDate = cDate;
                                                                    }
                                                                }
                                                            });

                                                            const maxDate = new Date(minDate);
                                                            maxDate.setMonth(maxDate.getMonth() + 6);
                                                            maxDate.setHours(23, 59, 59, 999);

                                                            return (
                                                                <PremiumDatePicker
                                                                    locale={lang}
                                                                    label=""
                                                                    value={startDate}
                                                                    minDate={minDate}
                                                                    maxDate={maxDate}
                                                                    onChange={(val: string) => {
                                                                        const [d, m, y] = val.split('.').map(Number);
                                                                        if (d && m && y) {
                                                                            const selected = new Date(y, m - 1, d);
                                                                            if (selected < minDate) {
                                                                                const dStr = String(minDate.getDate()).padStart(2, '0');
                                                                                const mStr = String(minDate.getMonth() + 1).padStart(2, '0');
                                                                                setStartDate(`${dStr}.${mStr}.${minDate.getFullYear()}`);
                                                                                return;
                                                                            }
                                                                            if (selected > maxDate) {
                                                                                const dStr = String(maxDate.getDate()).padStart(2, '0');
                                                                                const mStr = String(maxDate.getMonth() + 1).padStart(2, '0');
                                                                                setStartDate(`${dStr}.${mStr}.${maxDate.getFullYear()}`);
                                                                                return;
                                                                            }
                                                                        }
                                                                        setStartDate(val);
                                                                    }}
                                                                />
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* RIGHT BOX: Kostenübersicht (Price Preview) */}
                                                <div className="enrollment-panel border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-4 sm:p-5 relative flex flex-col h-full min-h-[294px]">
                                                    {/* Ambient Glow */}
                                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                                        <div aria-hidden="true" className="hidden absolute -bottom-24 -right-24 w-48 h-48 bg-[radial-gradient(circle,rgba(251,146,60,0.15)_0%,transparent_70%)] rounded-full" />
                                                    </div>
                                                    {/* Header */}
                                                    <span className={cn("font-sans tabular-nums text-xs tracking-normal text-[var(--accent-text)] uppercase mb-0", monoClassName)}>
                                                        {wizard?.sidebar_hint_title || germanDictionary.registration.wizard.sidebar_hint_title}
                                                    </span>

                                                    {/* Content Area */}
                                                    <AnimatePresence mode="wait">
                                                        {selectedCoursesFull.length === 0 ? (
                                                            /* Empty State - Centered Placeholder */
                                                            <motion.div
                                                                key="empty"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="flex-1 flex flex-col items-center justify-center text-center"
                                                            >
                                                                <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                                                    <Monitor size={32} className="text-gray-300 dark:text-gray-600" />
                                                                </div>
                                                                <p className={cn("text-xs md:text-sm text-[var(--muted)] font-medium max-w-[200px]", monoClassName)}>
                                                                    {formLabels?.select_course_hint || germanDictionary.registration.form.select_course_hint}
                                                                </p>
                                                            </motion.div>
                                                        ) : (
                                                            /* Active State - PricingRoadmap */
                                                            <motion.div
                                                                key="content"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="flex-1 w-full flex flex-col justify-center"
                                                            >
                                                                <PricingRoadmap
                                                                    dictionary={dictionary}
                                                                    lang={lang}
                                                                    startDate={startDate}
                                                                    selectedCourses={selectedCoursesFull}
                                                                    courseSelections={courseSelections}
                                                                    currentMonthPrice={totalMonthlyPrice}
                                                                    exceptions={exceptions}
                                                                />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    {/* Footer Link - Anchored to bottom */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPaymentInfo(prev => !prev)}
                                                        className="min-h-11 mt-3 text-sm text-[var(--muted)] underline decoration-dotted hover:text-[var(--accent-text)] transition-colors text-left"
                                                    >
                                                        {t?.pricing_roadmap?.how_payment_works || germanDictionary.registration.pricing_roadmap.how_payment_works}
                                                    </button>

                                                    {/* Payment Info Floating Glass Card Popover */}
                                                    <AnimatePresence>
                                                        {showPaymentInfo && (
                                                            <>
                                                                {/* Invisible Overlay to close on click outside */}
                                                                <div
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={() => setShowPaymentInfo(false)}
                                                                />

                                                                {/* Floating Glass Card */}
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                                    transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
                                                                    className="absolute top-[calc(100%+8px)] left-0 w-full z-50 bg-white/90 dark:bg-[#1A1C1E]/90 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-xl p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)]"
                                                                >
                                                                    {/* Content Layout */}
                                                                    <div className="flex gap-4">
                                                                        {/* Trust Icon */}
                                                                        <div className="shrink-0 mt-0.5">
                                                                            <CheckCircle2 size={20} className="text-[var(--accent-text)]" />
                                                                        </div>

                                                                        {/* Text Block */}
                                                                        <div className="flex flex-col gap-2">
                                                                            {/* Headline */}
                                                                            <h4 className="text-sm font-semibold text-[var(--foreground)]">
                                                                                {t?.pricing_roadmap?.payment_popover_title || germanDictionary.registration.pricing_roadmap.payment_popover_title}
                                                                            </h4>

                                                                            {/* Bullet Points */}
                                                                            <ul className="space-y-1.5">
                                                                                <li className="text-xs text-[var(--muted)] flex items-start gap-2">
                                                                                    <span className="text-[var(--accent-text)] mt-0.5">•</span>
                                                                                    <span>{t?.pricing_roadmap?.payment_point_1 || "Sie zahlen heute nur den ersten Monat."}</span>
                                                                                </li>
                                                                                <li className="text-xs text-[var(--muted)] flex items-start gap-2">
                                                                                    <span className="text-[var(--accent-text)] mt-0.5">•</span>
                                                                                    <span>{t?.pricing_roadmap?.payment_point_2 || "Danach entscheiden Sie flexibel weiter."}</span>
                                                                                </li>
                                                                                <li className="text-xs text-[var(--muted)] flex items-start gap-2">
                                                                                    <span className="text-[var(--accent-text)] mt-0.5">•</span>
                                                                                    <span>{t?.pricing_roadmap?.payment_point_3 || "Kündbar bis zum 25. des Monats."}</span>
                                                                                </li>
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="col-span-1 xl:col-span-2 enrollment-panel border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-4 sm:p-5 relative flex flex-col h-full overflow-hidden">
                                                {/* Ambient Glow */}
                                                <div aria-hidden="true" className="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[radial-gradient(circle,rgba(251,146,60,0.1)_0%,transparent_70%)] rounded-full pointer-events-none" />
                                                {/* Header */}
                                                <span className={cn("font-sans tabular-nums text-xs tracking-normal text-[var(--accent-text)] uppercase mb-6", monoClassName)}>
                                                    {trialT?.select_day || germanDictionary.registration.trial.select_day}
                                                </span>

                                                {selectedCourseIds.length === 0 ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                                                        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                                            <CalendarDays size={32} className="text-gray-300 dark:text-gray-600" />
                                                        </div>
                                                        <p className={cn("text-xs md:text-sm text-[var(--muted)] font-medium max-w-[200px]", monoClassName)}>
                                                            {formLabels?.select_course_hint || germanDictionary.registration.form.select_course_hint}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col justify-center">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                            {trialDates.map(d => (
                                                                <button
                                                                    key={d.iso}
                                                                    type="button"
                                                                    onClick={() => setTrialDate(d.iso)}
                                                                    className={cn(
                                                                        "min-h-11 text-left px-4 py-3 rounded-xl border transition-colors duration-200 font-sans tabular-nums text-sm",
                                                                        trialDate === d.iso
                                                                            ? "bg-[var(--accent-soft)] dark:bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent-text)] font-semibold shadow-sm"
                                                                            : "border-black/5 dark:border-white/5 text-gray-700 dark:text-gray-300 hover:border-[var(--accent)] dark:hover:border-[var(--accent)]"
                                                                    )}
                                                                >
                                                                    {trialDate === d.iso && <Check size={12} className="inline mr-2" />}
                                                                    {d.label}
                                                                </button>
                                                            ))}
                                                            {trialDates.length === 0 && (
                                                                <p className="text-xs text-gray-500 font-sans tabular-nums italic mt-2 col-span-full">
                                                                    {trialT?.no_dates || germanDictionary.registration.trial.no_dates}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* === COURSE LIST (Full Width Below Control Deck) === */}
                                    {[
                                        { title: groupTitles?.presence || germanDictionary.registration.group_titles.presence, courses: presenceCourses },
                                        { title: groupTitles?.speech || germanDictionary.registration.group_titles.speech, courses: speechCourses },
                                        { title: groupTitles?.online || germanDictionary.registration.group_titles.online, courses: onlineCourses }
                                    ].map((group, idx) => (
                                        <section key={idx} className="mb-8">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="font-sans tabular-nums text-xs tracking-normal text-black dark:text-[var(--accent-text)]">{group.title}</span>
                                                <div className="h-px bg-black/20 dark:bg-white/20 flex-1" />
                                            </div>
                                            <div className="space-y-4">
                                                {group.courses.map(c => (
                                                    <div key={c.id} className="space-y-2"><CourseRow course={c} selected={selectedCourseIds.includes(c.id)} onToggle={() => toggleCourse(c.id)} {...getCourseData(c)} />{!isTrialMode && c.category==='private' && selectedCourseIds.includes(c.id) && <CourseQuantityInput value={requestedUnits[c.id]??1} onChange={value=>setRequestedUnits(current=>({...current,[c.id]:value}))} unitMinutes={c.unitMinutes} unitPrice={c.unitPrice} lang={lang}/>}</div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}


                                </motion.div>
                            )}

                            {/* STEP 2: PERSONAL DATA */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    variants={stepVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="enrollment-personal enrollment-panel rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-7 max-w-3xl relative z-10"
                                >
                                    <div className="space-y-6">

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <TerminalInput 
                                                label={formLabels?.firstname || germanDictionary.registration.form.firstname}
                                                required 
                                                registration={register("personal.firstName")} 
                                                error={errors.personal?.firstName?.message} 
                                                onFocus={() => setFocusedField('firstName')}
                                                onBlur={() => setFocusedField(null)}
                                                isDimmed={focusedField !== null && focusedField !== 'firstName'}
                                            />
                                            <TerminalInput 
                                                label={formLabels?.lastname || germanDictionary.registration.form.lastname}
                                                required 
                                                registration={register("personal.lastName")} 
                                                error={errors.personal?.lastName?.message} 
                                                onFocus={() => setFocusedField('lastName')}
                                                onBlur={() => setFocusedField(null)}
                                                isDimmed={focusedField !== null && focusedField !== 'lastName'}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <TerminalInput 
                                                label={formLabels?.email || germanDictionary.registration.form.email}
                                                type="email" 
                                                required 
                                                registration={register("personal.email")} 
                                                error={errors.personal?.email?.message} 
                                                onFocus={() => setFocusedField('email')}
                                                onBlur={() => setFocusedField(null)}
                                                isDimmed={focusedField !== null && focusedField !== 'email'}
                                            />
                                            {/* DateDropdowns might need a wrapper to support dimming, applying simple class here */}
                                            <div className={cn("transition-opacity duration-500", focusedField !== null && focusedField !== 'birthDate' ? "opacity-30" : "opacity-100")}
                                                 onFocusCapture={() => setFocusedField('birthDate')} 
                                                 onBlurCapture={() => setFocusedField(null)}>
                                                <DateDropdowns
                                                    label={formLabels?.birthdate || germanDictionary.registration.form.birthdate}
                                                    required
                                                    value={watch("personal.birthDate")}
                                                    onChange={(val: string) => form.setValue("personal.birthDate", val, { shouldValidate: true })}
                                                    error={errors.personal?.birthDate?.message}
                                                    referenceDate={new Date()}
                                                />
                                            </div>
                                        </div>
                                        
                                        <PhoneInput
                                            countryCodeLabel={formLabels.country_code}
                                            label={formLabels?.phone || germanDictionary.registration.form.phone}
                                            value={watch("personal.phone")}
                                            onChange={(val: string) => form.setValue("personal.phone", val, { shouldValidate: true })}
                                            error={errors.personal?.phone?.message}
                                            onFocus={() => setFocusedField('phone')}
                                            onBlur={() => setFocusedField(null)}
                                            isDimmed={focusedField !== null && focusedField !== 'phone'}
                                        />

                                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,3fr)_minmax(7rem,1fr)]">
                                            <TerminalInput 
                                                label={formLabels?.street || germanDictionary.registration.form.street}
                                                required 
                                                registration={register("personal.street")} 
                                                error={errors.personal?.street?.message} 
                                                onFocus={() => setFocusedField('street')}
                                                onBlur={() => setFocusedField(null)}
                                                isDimmed={focusedField !== null && focusedField !== 'street'}
                                            />
                                            <TerminalInput 
                                                label={formLabels?.zip || germanDictionary.registration.form.zip}
                                                required 
                                                registration={register("personal.zip")} 
                                                maxLength={5} 
                                                error={errors.personal?.zip?.message} 
                                                onFocus={() => setFocusedField('zip')}
                                                onBlur={() => setFocusedField(null)}
                                                isDimmed={focusedField !== null && focusedField !== 'zip'}
                                            />
                                        </div>
                                        <TerminalInput 
                                            label={formLabels?.city || germanDictionary.registration.form.city}
                                            required 
                                            registration={register("personal.city")} 
                                            error={errors.personal?.city?.message} 
                                            onFocus={() => setFocusedField('city')}
                                            onBlur={() => setFocusedField(null)}
                                            isDimmed={focusedField !== null && focusedField !== 'city'}
                                        />

                                        <div className="text-xs text-gray-400 font-sans tabular-nums tracking-normal text-right">
                                            {formLabels?.required_hint}
                                        </div>

                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: SUMMARY */}
                            {/* --- SUMMARY (STEP 3) --- */}
                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    variants={stepVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    className="flex flex-col gap-8 h-full relative z-10"
                                >
                                    {/* LEGAL CONSENTS (Moved to Top) */}
                                    <div className="enrollment-panel border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-5 sm:p-7 relative overflow-hidden">
                                        <div aria-hidden="true" className="hidden absolute -top-24 -right-24 w-48 h-48 bg-[radial-gradient(circle,rgba(251,146,60,0.15)_0%,transparent_70%)] rounded-full pointer-events-none" />
                                        <div className="relative z-10">
                                        <h3 className="font-semibold text-lg tracking-normal mb-2 border-b border-[var(--border)] pb-4">{wizard?.legal_title}</h3>
                                        <div className="space-y-4 pt-2">
                                            <LegalCheckbox
                                                id="privacy"
                                                label={t?.legal?.privacy || germanDictionary.registration.legal.privacy}
                                                checked={consents.privacy}
                                                onChange={(v) => setConsents(prev => ({ ...prev, privacy: v }))}
                                            />
                                            <LegalCheckbox
                                                id="agb"
                                                label={t?.legal?.agb || germanDictionary.registration.legal.agb}
                                                checked={consents.agb}
                                                onChange={(v) => setConsents(prev => ({ ...prev, agb: v }))}
                                            />
                                            <LegalCheckbox
                                                id="revocation"
                                                label={t?.legal?.revocation || germanDictionary.registration.legal.revocation}
                                                checked={consents.revocation}
                                                onChange={(v) => setConsents(prev => ({ ...prev, revocation: v }))}
                                            />
                                            {hasOnlineCourse && (
                                                <LegalCheckbox
                                                    id="videoRecording"
                                                    label={t?.legal?.video_recording || germanDictionary.registration.legal.video_recording}
                                                    checked={consents.videoRecording}
                                                    onChange={(v) => setConsents(prev => ({ ...prev, videoRecording: v }))}
                                                />
                                            )}
                                        </div>
                                        <p className="text-xs md:text-sm font-medium text-[var(--muted)] text-right mt-6">
                                            {formLabels?.required_hint}
                                        </p>
                                    </div>
                                    </div>
                                    <div className="enrollment-panel border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7 rounded-2xl h-full flex flex-col justify-between relative overflow-hidden">
                                        <div aria-hidden="true" className="hidden absolute -bottom-32 -left-32 w-64 h-64 bg-[radial-gradient(circle,rgba(251,146,60,0.1)_0%,transparent_70%)] rounded-full pointer-events-none" />
                                        <div className="relative z-10 flex flex-col h-full">
                                        <div><h3 className="font-semibold text-lg tracking-normal mb-6 border-b border-[var(--border)] pb-4">{wizard?.summary_data_title}</h3></div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 text-sm">
                                            <div className="text-gray-500">{wizard?.summary_labels?.name || germanDictionary.registration.wizard.summary_labels.name}</div>
                                            <div className="font-medium text-[var(--foreground)]">{formData?.firstName} {formData?.lastName}</div>
                                            <div className="text-gray-500">{wizard?.summary_labels?.contact || germanDictionary.registration.wizard.summary_labels.contact}</div>
                                            <div className="font-medium break-all text-[var(--foreground)]">{formData?.email}<br />{formData?.phone}</div>
                                            <div className="text-gray-500">{wizard?.summary_labels?.personal || germanDictionary.registration.wizard.summary_labels.personal}</div>
                                            <div className="font-medium text-[var(--foreground)]">{formData?.birthDate}</div>
                                            <div className="text-gray-500">{wizard?.summary_labels?.address || germanDictionary.registration.wizard.summary_labels.address}</div>
                                            <div className="font-medium text-[var(--foreground)]">{formData?.street}<br />{formData?.zip} {formData?.city}</div>
                                        </div>
                                        <button onClick={() => setStep(2)} className="inline-flex min-h-11 items-center text-[var(--accent-text)] text-sm font-semibold hover:underline mt-4">
                                            {wizard?.edit}
                                        </button>
                                        </div>
                                    </div>

                                    {/* Summary: Courses */}
                                    <div className="enrollment-panel bg-[var(--surface)] p-5 sm:p-7 border border-[var(--border)] rounded-2xl space-y-6">
                                        <h3 className="font-semibold text-lg tracking-normal mb-6 border-b border-[var(--border)] pb-4">{wizard?.summary_courses_title} {currentMonthLabel}</h3>
                                        <div className="space-y-4">
                                            {selectedCoursesFull.map(c => {
                                                const [d, m, y] = startDate.split('.').map(Number);
                                                const { totalUnits, deductions } = calculateMonthlyStats(c, lang, m - 1, y, exceptions, d, requestedUnits[c.id]??1);
                                                const netPrice = c.unitPrice * totalUnits;
                                                return (
                                                    <div key={c.id} className="flex justify-between items-center text-sm">
                                                        <span className="font-semibold text-[var(--foreground)]">{courseText(c, lang).title}<span className="mt-1 block text-base font-normal text-[var(--muted)]">{formatCourseQuantity(totalUnits,c.unitMinutes,lang)}</span></span>
                                                        <div className="text-right">
                                                            <span className="font-sans tabular-nums text-[var(--foreground)]">{formatPrice(netPrice)}</span>
                                                            {deductions.length > 0 && (
                                                                <div className="text-xs text-red-500 text-right">
                                                                    ({receipt?.incl || germanDictionary.registration.receipt.incl} {deductions.length} {deductions.length === 1 ? receipt?.cancellation_s || germanDictionary.registration.receipt.cancellation_s : receipt?.cancellation_p || germanDictionary.registration.receipt.cancellation_p})
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => setStep(1)} className="inline-flex min-h-11 items-center text-[var(--accent-text)] text-sm font-semibold hover:underline mt-4">
                                            {wizard?.change_selection}
                                        </button>
                                    </div>


                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* The grid and sticky positioning stay outside all motion/layout animations. */}
            {/* Mobile keeps the summary in the form's natural reading order. */}
            <div className="enrollment-receipt relative z-20 flex w-full min-w-0 flex-col lg:sticky lg:top-8 lg:my-6">
                <div aria-hidden="true" className="hidden" />

                {/* RECEIPT HEADER */}
                <div className="enrollment-receipt-heading px-5 pt-6 pb-4 shrink-0 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-sans tabular-nums text-xs text-[var(--accent-text)] tracking-normal">
                                {isTrialMode ? (trialT?.badge || germanDictionary.registration.trial.badge) : (receipt?.live_title || germanDictionary.registration.receipt.live_title)}
                            </span>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </div>
                        {!isTrialMode && <span className="font-sans tabular-nums text-xs text-gray-500">{currentMonthLabel}</span>}
                    </div>
                </div>

                <div className="enrollment-receipt-items flex-1 p-5 space-y-4 min-h-[100px] min-w-0">
                    {isTrialMode && trialCourse ? (
                        <div className="space-y-6">
                            {/* Course */}
                            <div className="font-sans tabular-nums text-sm border-b border-white/5 pb-4">
                                <div className="flex justify-between items-start mb-1 gap-4">
                                    <span className="text-gray-200 font-semibold flex-1 break-words">
                                        {courseText(trialCourse, lang).title}
                                    </span>
                                    <span className="text-green-400 font-semibold whitespace-nowrap">{trialT?.price_label || germanDictionary.registration.trial.price_label}</span>
                                </div>
                                <div className="text-xs text-gray-500 uppercase mt-1">
                                    {trialT?.badge || germanDictionary.registration.trial.badge}
                                </div>
                            </div>

                            {/* Selected Date */}
                            {trialDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <CalendarDays size={14} className="text-[var(--accent-text)]" />
                                    <span className="font-sans tabular-nums">{trialDates.find(d => d.iso === trialDate)?.label || trialDate}</span>
                                </div>
                            )}

                            {/* Contact Summary */}
                            {formData?.firstName && (
                                <div className="text-xs text-gray-500 font-sans tabular-nums space-y-1 pt-2 border-t border-white/5">
                                    <div>{formData.firstName} {formData.lastName}</div>
                                    {formData.email && <div className="text-gray-400">{formData.email}</div>}
                                    {formData.phone && <div>{formData.phone}</div>}
                                </div>
                            )}
                        </div>
                    ) : (
                        <AnimatePresence>
                            {selectedCoursesFull.length === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-600 font-sans tabular-nums text-xs italic mt-10 text-center">
                                {receipt?.waiting || germanDictionary.registration.receipt.waiting}
                                </motion.div>
                            ) : (
                                selectedCoursesFull.map(c => {
                                    const [d, m, y] = startDate.split('.').map(Number);
                                    const { sessionCount, totalUnits, deductions } = calculateMonthlyStats(c, lang, m - 1, y, exceptions, d, requestedUnits[c.id]??1);
                                    const netPrice = c.unitPrice * totalUnits;
                                    const deductionSum = deductions.reduce((acc, d) => acc + d.amount, 0);
                                    const grossPrice = netPrice + deductionSum;

                                    return (
                                        <motion.div
                                            key={c.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="font-sans tabular-nums text-sm border-b border-white/5 pb-3 last:border-0"
                                        >
                                            <div className="flex justify-between items-start mb-1 gap-4">
                                                <span className="text-gray-200 font-semibold flex-1 break-words">{courseText(c, lang).title}</span>
                                                <span className="text-white whitespace-nowrap">{formatPrice(grossPrice)}</span>
                                            </div>

                                            {deductions.map((d, i) => (
                                                <div key={i} className="flex justify-between text-xs text-red-500 mb-1">
                                                    <span>{d.date}: {d.reason}</span>
                                                    <span>- {formatPrice(d.amount)}</span>
                                                </div>
                                            ))}

                                            <div className="flex justify-between text-xs text-gray-500 uppercase mt-1">
                                                <span>{c.category==='private'?formatCourseQuantity(totalUnits,c.unitMinutes,lang):<>{totalUnits} {receipt?.units || germanDictionary.registration.receipt.units} ({sessionCount} {receipt?.sessions || germanDictionary.registration.receipt.sessions})</>}</span>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </AnimatePresence>
                    )}
                </div>

                {/* FOOTER AREA (Total + Action) */}
                <div
                    ref={footerRef}
                    className="enrollment-receipt-footer p-0 relative shrink-0 z-50"
                >

                    {/* TOTAL Display */}
                    {isTrialMode ? (
                        <div className="enrollment-receipt-total p-5 border-t border-[var(--border)]">
                            <div className="flex justify-between items-end mb-2">
                                <span className="font-sans tabular-nums text-xs text-gray-400">{trialT?.price_label || germanDictionary.registration.trial.price_label}</span>
                                <span className="text-2xl md:text-3xl font-semibold tracking-tight tabular-nums text-green-400">{formatPrice(0)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 font-sans tabular-nums">
                                <span>{trialT?.badge || germanDictionary.registration.trial.badge}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="enrollment-receipt-total p-5 border-t border-[var(--border)]">
                            <div className="flex justify-between items-end mb-2">
                                <span className="font-sans tabular-nums text-xs text-gray-400">{wizard?.total_label}</span>
                                <motion.span
                                    key={totalMonthlyPrice}
                                    initial={{ scale: 1.04 }}
                                    animate={{ scale: 1 }}
                                    className="text-2xl md:text-3xl font-semibold tracking-tight tabular-nums"
                                >
                                    {formatPrice(totalMonthlyPrice)}
                                </motion.span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 font-sans tabular-nums">
                                <span>{wizard?.total_sub_1}</span>
                                <span>{wizard?.total_sub_2}</span>
                            </div>
                        </div>
                    )}



                    {/* ACTION BUTTON */}
                    {isTrialMode ? (
                        <button
                            onClick={step === 3 ? handleSubmit(onTrialSubmit) : handleNextStep}
                            disabled={
                                (step === 1 && (selectedCourseIds.length === 0 || !trialDate)) ||
                                (step === 2 && (!isValid || trialCheckLoading)) ||
                                (step === 3 && !isLegalValid) ||
                                trialEligible === false ||
                                isSubmitting
                            }
                            className={cn(
                                "enrollment-submit w-full min-h-16 font-semibold text-sm flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-200 group z-10 relative",
                                (
                                    (step === 1 && (selectedCourseIds.length === 0 || !trialDate)) ||
                                    (step === 2 && !isValid) ||
                                    (step === 3 && !isLegalValid) ||
                                    trialEligible === false
                                )
                                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                    : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                            )}
                        >
                            <span className="flex flex-col items-start gap-1">
                                <span className="text-xs opacity-70 font-sans tabular-nums normal-case tracking-normal">
                                    {step === 1 ? wizard?.btn_next : step === 2 ? wizard?.btn_almost : (trialT?.badge || germanDictionary.registration.trial.badge)}
                                </span>
                                <span>
                                    {step === 1 && wizard?.btn_continue}
                                    {step === 2 && (trialCheckLoading ? <Loader2 className="animate-spin" /> : wizard?.btn_overview)}
                                    {step === 3 && (isSubmitting ? <Loader2 className="animate-spin" /> : (trialT?.submit_button || germanDictionary.registration.trial.submit_button))}
                                </span>
                            </span>
                            {step === 3 ? (
                                <Gift className={cn("transition-transform duration-300",
                                    !isLegalValid || trialEligible === false ? "opacity-20" : "group-hover:translate-x-2"
                                )} />
                            ) : (
                                <ArrowRight className={cn("transition-transform duration-300",
                                    (step === 1 && (selectedCourseIds.length === 0 || !trialDate)) || (step === 2 && !isValid) ? "opacity-20" : "group-hover:translate-x-2"
                                )} />
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={step === 3 ? handleSubmit(onSubmit) : handleNextStep}
                            disabled={(step === 1 && selectedCourseIds.length === 0) || (step === 2 && !isValid) || (step === 3 && !isLegalValid) || isSubmitting}
                            className={cn(
                                "enrollment-submit w-full min-h-16 font-semibold text-sm flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-200 group z-10 relative",
                                ((step === 1 && selectedCourseIds.length === 0) || (step === 2 && !isValid) || (step === 3 && !isLegalValid))
                                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                    : "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"
                            )}
                        >
                            <span className="flex flex-col items-start gap-1">
                                <span className="text-xs opacity-70 font-sans tabular-nums normal-case tracking-normal">
                                    {step === 1 ? wizard?.btn_next : step === 2 ? wizard?.btn_almost : wizard?.btn_binding}
                                </span>
                                <span>
                                    {step === 1 && wizard?.btn_continue}
                                    {step === 2 && wizard?.btn_overview}
                                    {step === 3 && (isSubmitting ? <Loader2 className="animate-spin" /> : wizard?.btn_order)}
                                </span>
                            </span>

                            <ArrowRight className={cn("transition-transform duration-300",
                                ((step === 1 && selectedCourseIds.length === 0) || (step === 2 && !isValid) || (step === 3 && !isLegalValid)) ? "opacity-20" : "group-hover:translate-x-2"
                            )} />
                        </button>
                    )}

                </div>
            </div>
        </div >
        </MotionConfig>
    );
}
