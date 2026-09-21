"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toUiLocale } from "@/lib/locale-routing";
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

// Hook for adding drag-to-scroll and mouse-wheel scrolling
const useHorizontalScroll = () => {
    const elRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const el = elRef.current;
        if (!el) return;

        let isDragging = false;
        let startX = 0;
        let scrollLeft = 0;
        let velocity = 0;
        let animationFrameId: number;
        let lastTimestamp = 0;
        let lastX = 0;

        const onWheel = (e: WheelEvent) => {
            if (e.deltaY === 0) return;
            // Prevent default vertical scroll if we can scroll horizontally
            if (
                (e.deltaY < 0 && el.scrollLeft > 0) ||
                (e.deltaY > 0 && Math.ceil(el.scrollLeft) < el.scrollWidth - el.clientWidth)
            ) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        const momentumLoop = () => {
            if (isDragging) return;
            el.scrollLeft += velocity;
            velocity *= 0.95; // Friction factor
            if (Math.abs(velocity) > 0.5) {
                animationFrameId = requestAnimationFrame(momentumLoop);
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            isDragging = true;
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
            lastX = e.pageX;
            lastTimestamp = performance.now();
            velocity = 0;
            cancelAnimationFrame(animationFrameId);
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 2;
            
            // Calculate velocity for inertia
            const currentTimestamp = performance.now();
            const dt = currentTimestamp - lastTimestamp;
            if (dt > 0) {
                const dx = lastX - e.pageX;
                velocity = dx * (16 / dt) * 1.5; // normalize to 60fps
            }
            lastTimestamp = currentTimestamp;
            lastX = e.pageX;
            
            // If scrolled more than 5px, disable clicks on children so we don't accidentally select a date
            if (Math.abs(walk) > 5) {
                el.classList.add('pointer-events-none-children');
            }
            
            el.scrollLeft = scrollLeft - walk;
        };

        const onPointerUpOrLeave = () => {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = '';
            el.style.removeProperty('user-select');
            
            // Start momentum
            animationFrameId = requestAnimationFrame(momentumLoop);
            
            // Timeout ensures that the click event is fired before we re-enable pointer events
            setTimeout(() => {
                el.classList.remove('pointer-events-none-children');
            }, 0);
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUpOrLeave);
        el.addEventListener('pointerleave', onPointerUpOrLeave);

        return () => {
            cancelAnimationFrame(animationFrameId);
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerUpOrLeave);
            el.removeEventListener('pointerleave', onPointerUpOrLeave);
        };
    }, []);

    return elRef;
};


interface PremiumDatePickerProps {
    value: string; // "DD.MM.YYYY"
    onChange: (val: string) => void;
    label?: string;
    error?: string;
    required?: boolean;
    minDate: Date;
    maxDate: Date;
    locale?: string;
}

export const PremiumDatePicker = ({
    value,
    onChange,
    label,
    error,
    required,
    minDate,
    maxDate,
    locale = "de",
}: PremiumDatePickerProps) => {
    const calendarLocale = toUiLocale(locale);
    const monthsRef = useHorizontalScroll();
    const daysRef = useHorizontalScroll();

    // Helper to format/parse
    const [dStr, mStr, yStr] = (value || "").split(".");
    
    // Internal state for selected month/year to view
    const [viewMonth, setViewMonth] = useState<number>(parseInt(mStr) || minDate.getMonth() + 1);
    const [viewYear, setViewYear] = useState<number>(parseInt(yStr) || minDate.getFullYear());

    // Sync view with value when value changes externally
    useEffect(() => {
        if (mStr && yStr) {
            setViewMonth(parseInt(mStr));
            setViewYear(parseInt(yStr));
        }
    }, [mStr, yStr]);

    // Calculate available months
    const availableMonths = useMemo(() => {
        const months = [];
        let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        
        while (curr <= end) {
            months.push({
                month: curr.getMonth() + 1,
                year: curr.getFullYear(),
                label: curr.toLocaleString(calendarLocale, { month: 'long' }) + (curr.getFullYear() !== minDate.getFullYear() ? ` '${String(curr.getFullYear()).slice(-2)}` : '')
            });
            curr.setMonth(curr.getMonth() + 1);
        }
        return months;
    }, [minDate, maxDate, calendarLocale]);

    // Calculate available days for the currently viewed month
    const availableDays = useMemo(() => {
        const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(viewYear, viewMonth - 1, i);
            
            // Check min/max constraints
            const dateOnly = new Date(dateObj);
            dateOnly.setHours(0,0,0,0);
            
            const minOnly = new Date(minDate);
            minOnly.setHours(0,0,0,0);
            
            const maxOnly = new Date(maxDate);
            maxOnly.setHours(23,59,59,999);
            
            const isDisabled = dateOnly < minOnly || dateOnly > maxOnly;
            
            days.push({
                day: i,
                dayOfWeek: dateObj.toLocaleString(calendarLocale, { weekday: 'short' }),
                isDisabled
            });
        }
        return days;
    }, [viewYear, viewMonth, minDate, maxDate, calendarLocale]);

    const handleMonthSelect = (m: number, y: number) => {
        setViewMonth(m);
        setViewYear(y);
        
        // If we change month, try to keep the same day if valid, otherwise clamp
        const currentSelectedDay = parseInt(dStr);
        let newDay = currentSelectedDay;
        
        const daysInNewMonth = new Date(y, m, 0).getDate();
        if (newDay > daysInNewMonth) newDay = daysInNewMonth;
        
        // Check min/max clamping for the day
        const tempDate = new Date(y, m - 1, newDay);
        if (tempDate < minDate) newDay = minDate.getDate();
        if (tempDate > maxDate) newDay = maxDate.getDate();
        
        const formatStr = (n: number) => String(n).padStart(2, '0');
        onChange(`${formatStr(newDay)}.${formatStr(m)}.${y}`);
    };

    const handleDaySelect = (d: number) => {
        const formatStr = (n: number) => String(n).padStart(2, '0');
        onChange(`${formatStr(d)}.${formatStr(viewMonth)}.${viewYear}`);
    };

    const currentSelectedDay = parseInt(dStr);

    return (
        <div className="relative flex flex-col w-full z-40 select-none pt-4">
            {label && (
                <span className={cn(
                    "text-xs uppercase tracking-widest text-gray-500 mb-6 block",
                    jetbrainsMono.className
                )}>
                    {label} {required && <span className="text-[var(--accent-text)]">*</span>}
                </span>
            )}
            
            {/* Months Scroll */}
            <div 
                ref={monthsRef}
                className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 w-full premium-scrollbar scroll-smooth-disabled"
            >
                {availableMonths.map((m) => {
                    const isActive = viewMonth === m.month && viewYear === m.year;
                    return (
                        <button
                            key={`${m.month}-${m.year}`}
                            onClick={() => handleMonthSelect(m.month, m.year)}
                            className={cn(
                                "relative px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap",
                                isActive ? "text-[var(--accent-foreground)]" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100/50 dark:bg-white/5"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeMonth"
                                    className="absolute inset-0 bg-[var(--accent-strong)] rounded-full shadow-md shadow-[var(--accent)]/20"
                                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10">{m.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Days Scroll */}
            <div 
                ref={daysRef}
                className="flex items-center gap-3 overflow-x-auto pb-6 pt-1 w-full premium-scrollbar scroll-smooth-disabled"
            >
                {availableDays.map((d) => {
                    const isActive = currentSelectedDay === d.day && viewMonth === parseInt(mStr) && viewYear === parseInt(yStr);
                    return (
                        <button
                            key={d.day}
                            onClick={() => !d.isDisabled && handleDaySelect(d.day)}
                            disabled={d.isDisabled}
                            className={cn(
                                "relative flex flex-col items-center justify-center min-w-[64px] h-[84px] rounded-2xl transition-all shrink-0",
                                d.isDisabled ? "opacity-30 cursor-not-allowed bg-gray-50 dark:bg-white/5" : "cursor-pointer bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20 shadow-sm",
                                isActive ? "text-white border-transparent dark:border-transparent" : "text-gray-700 dark:text-gray-300"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeDay"
                                    className="absolute inset-0 bg-gray-900 dark:bg-white rounded-2xl shadow-xl"
                                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                />
                            )}
                            <span className={cn(
                                "relative z-10 text-[11px] uppercase font-bold tracking-wider mb-1",
                                isActive ? "text-gray-400 dark:text-gray-500" : "text-gray-400"
                            )}>
                                {d.dayOfWeek}
                            </span>
                            <span className={cn(
                                "relative z-10 text-2xl font-bold",
                                isActive ? "text-white dark:text-black" : ""
                            )}>
                                {d.day}
                            </span>
                            {/* Orange dot indicator for active day */}
                            {isActive && (
                                <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[var(--accent-strong)]" />
                            )}
                        </button>
                    );
                })}
            </div>

            {error && <span className={cn("text-red-500 text-[10px] mt-2", jetbrainsMono.className)}>{error}</span>}
        </div>
    );
};
