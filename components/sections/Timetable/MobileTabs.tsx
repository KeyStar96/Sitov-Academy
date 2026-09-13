"use client";
import { useParams } from "next/navigation";
import { courseText } from "@/lib/business-courses";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { CourseConfig, Day } from "@/lib/course-config";
import TimetableCard, { TimetableCourse } from "./TimetableCard";
import { cn } from "@/lib/utils";
import { getCurrentDayName, isCourseLive } from "@/lib/time-utils";

const DAYS: Day[] = ["Mo", "Di", "Mi", "Do", "Fr"];

interface MobileTabsProps {
    dictionary: any;
    courses: CourseConfig[];
}

export default function MobileTabs({ dictionary, courses }: MobileTabsProps) {
    const params=useParams();
    const lang=typeof params?.lang==='string'?params.lang:'de';
    const t = dictionary?.timetable || {};
    const dayNames = t.days || {};
    const courseTexts = dictionary?.CourseData || {};

    // Hydration-safe default (Monday), updated on mount
    const [activeDay, setActiveDay] = useState<Day>("Mo");
    const [ticker, setTicker] = useState(0);

    useEffect(() => {
        // Set correct start day once mounted (client-side)
        // If weekend (null), default to "Mo"
        const current = getCurrentDayName();
        // Validate current is a Day (it returns string | null). 
        // Cast or check. getCurrentDayName likely returns "Mo", "Di", etc.
        if (current && DAYS.includes(current as Day)) {
            setActiveDay(current as Day);
        } else {
            setActiveDay("Mo");
        }

        // Refresh live status
        const interval = setInterval(() => setTicker(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const getDayCourses = (day: Day): TimetableCourse[] => {
        const dayCourses: TimetableCourse[] = [];
        const sourceData = courses || [];

        sourceData.forEach(course => {
            course.sessions.forEach(session => {
                if (session.day === day) {
                    dayCourses.push({
                        id: `${course.id}-${session.day}-${session.startTime}`,
                        startTime: session.startTime,
                        endTime: session.endTime,
                        title: courseText(course,lang).title,
                        instructorKey: course.instructor,
                        locationKey: course.type,
                        isAlternating: session.isAlternating,
                        startDate: course.startDate
                    });

                    if (session.isAlternating && session.altStartTime && session.altEndTime) {
                        dayCourses.push({
                            id: `${course.id}-${session.day}-${session.altStartTime}-alt`,
                            startTime: session.altStartTime,
                            endTime: session.altEndTime,
                            title: courseText(course,lang).title,
                            instructorKey: course.instructor,
                            locationKey: course.type,
                            isAlternating: true,
                            startDate: course.startDate
                        });
                    }
                }
            });
        });
        return dayCourses.sort((a, b) => a.startTime.localeCompare(b.startTime));
    };

    // Scroll Animation for Mobile Timeline Stripe
    const containerRef = React.useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 80%", "end 80%"],
    });
    const scaleY = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    return (
        <div ref={containerRef} className="flex flex-col gap-8 relative">
            {/* 1. Pill Tabs Scroll Container */}
            <div className="overflow-x-auto pb-4 hide-scrollbar sticky top-[60px] z-20 bg-[#F0EFE9]/95 dark:bg-[#111111]/95 backdrop-blur-md py-2 -mx-4 px-4 w-[calc(100%+2rem)]">
                <div className="flex justify-center gap-2 px-2 min-w-max">
                    {DAYS.map((day) => {
                        const dayLabel = dayNames[day.toLowerCase()] || day;
                        const isActive = activeDay === day;

                        return (
                            <button
                                key={day}
                                onClick={() => setActiveDay(day)}
                                className={cn(
                                    "relative px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                                    isActive
                                        ? "bg-[#FF5C00] text-white shadow-lg shadow-orange-500/30"
                                        : "bg-white/50 backdrop-blur-sm text-black/60 border border-black/5 dark:bg-white/5 dark:text-white/60 dark:border-white/5"
                                )}
                            >
                                {dayLabel}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Content Area (Timeline) */}
            <div className="relative min-h-[400px] pl-4">
                {/* Timeline Line (Continuous) */}
                <div className="absolute left-[1.35rem] top-0 bottom-0 w-px bg-black/5 dark:bg-white/5 overflow-hidden">
                    <motion.div
                        style={{ scaleY }}
                        className="absolute top-0 left-0 w-full h-full bg-[#FF5C00] origin-top"
                    />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeDay}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col gap-6"
                    >
                        {getDayCourses(activeDay).length > 0 ? (
                            getDayCourses(activeDay).map((course) => {
                                const isLive = isCourseLive(activeDay, course.startTime, course.endTime);
                                return (
                                    <TimetableCard
                                        key={course.id}
                                        course={course}
                                        dictionary={dictionary}
                                        variant="mobile"
                                        isLive={isLive}
                                    />
                                );
                            })
                        ) : (
                            <div className="pl-12 py-12 text-sm text-black/60 dark:text-white/60 italic">
                                {t.labels?.no_courses_scheduled || "No courses scheduled."}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
