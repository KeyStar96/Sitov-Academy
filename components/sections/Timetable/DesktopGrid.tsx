"use client";
import { useParams } from "next/navigation";
import { courseText } from "@/lib/business-courses";

import React, { useRef } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { CourseConfig, Day } from "@/lib/course-config";
import TimetableCard, { TimetableCourse } from "./TimetableCard";
import { cn } from "@/lib/utils";
import { isCourseLive } from "@/lib/time-utils";

const DAYS: Day[] = ["Mo", "Di", "Mi", "Do", "Fr"];

interface DesktopGridProps {
    dictionary: any;
    courses: CourseConfig[];
}

export default function DesktopGrid({ dictionary, courses }: DesktopGridProps) {
    const params=useParams();
    const lang=typeof params?.lang==='string'?params.lang:'de';
    const t = dictionary?.timetable || {};
    const dayNames = t.days || {};
    const courseTexts = dictionary?.CourseData || {};

    const containerRef = useRef(null);
    const [ticker, setTicker] = React.useState(0);

    // Refresh every minute
    React.useEffect(() => {
        const interval = setInterval(() => setTicker(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    // Scroll Animation for the Orange Line ("Nerve" Effect)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 80%", "end 80%"],
    });

    const scaleY = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

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


    return (
        <motion.div
            ref={containerRef}
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-5 gap-8 relative mt-16"
        >
            {DAYS.map((day) => {
                const courses = getDayCourses(day);

                const rawName = dayNames[day.toLowerCase()] || day;
                const dayLabel = rawName;

                return (
                    <div key={day} className="relative flex flex-col h-full group/column">

                        {/* 1. Header: Swiss Clinical Style */}
                        <div className="flex flex-col mb-8 relative z-10 pl-[6px]">
                            <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-2 leading-none">
                                {dayLabel}
                            </h3>
                            {/* Technical Separator */}
                            <div className="w-12 h-[2px] bg-slate-900 dark:bg-white" />
                        </div>

                        {/* 2. Timeline Line: Measured Precision */}
                        <div className="absolute left-[6px] top-[5.5rem] bottom-0 w-px bg-black/10 dark:bg-white/10 z-0">
                            {/* 3. Orange "Nerve" Line Animation */}
                            <motion.div
                                style={{ scaleY }}
                                className="absolute top-0 left-0 w-full h-full bg-[#FF5C00] origin-top z-1"
                            />
                        </div>

                        {/* Courses Stack */}
                        <div className="flex flex-col gap-8 relative z-10 pt-4">
                            {courses.length > 0 ? (
                                courses.map((course) => {
                                    const isLive = isCourseLive(day, course.startTime, course.endTime);
                                    return (
                                        <motion.div key={course.id} variants={item}>
                                            <TimetableCard
                                                course={course}
                                                dictionary={dictionary}
                                                variant="desktop"
                                                isLive={isLive}
                                            />
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="pl-8 text-sm text-slate-500 dark:text-slate-400 font-mono uppercase tracking-widest">
                                    {t.labels?.no_courses_scheduled || "No courses scheduled."}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </motion.div>
    );
}
