"use client";

import React, { useState } from "react";
import { courseText } from "@/lib/business-courses";
import { motion, AnimatePresence } from "framer-motion";
import { JetBrains_Mono } from "next/font/google";
import { User, Clock, Gift, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseConfig, Day } from "@/lib/course-config";
import { useRouter, useParams } from "next/navigation";
import { MouseGlow } from "@/components/ui/MouseGlow";

import Link from "next/link";

// --- Fonts ---
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

// --- Types ---
type CourseType = "presence" | "online";

interface CourseText {
  title: string;
  description: string;
  level: string;
  location: string;
  unit?: string;
  start_badge?: string;
}

interface Dictionary {
  courses_v2: {
    label_small: string;
    headline: { line1: string; line2: string };
    tabs: Record<string, string>;
    footer_note: string;
    trial_cta?: string;
    start_prefix?: string;
  };
  CourseData: Record<string, CourseText>;
  timetable: {
    days: Record<string, string>;
    instructors: Record<string, string>;
  };
}

interface CoursesProps {
  dictionary: Dictionary;
  courses: CourseConfig[];
}

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};



export default function Courses({ dictionary, courses }: CoursesProps) {
  const [filter, setFilter] = useState<CourseType>("presence");
  const [isPending, startTransition] = React.useTransition();

  const sectionData = dictionary?.courses_v2;
  const courseTexts = dictionary?.CourseData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timetable = (dictionary?.timetable || {}) as any;
  const t_days = timetable?.days;
  const t_labels = timetable?.labels;
  const t_instructors = timetable?.instructors;

  const params = useParams();
  const lang = (params?.lang as string) || "de";
  const localeMap: Record<string, string> = {
    'de': 'de-DE',
    'en': 'en-US',
    'ru': 'ru-RU',
    'uk': 'uk-UA',
    'tr': 'tr-TR'
  };
  const localeTag = localeMap[lang] || 'de-DE';

  // Memoize displayed courses AND their formatted data to ensure stable props for children
  const displayedCourses = React.useMemo(() => {
    // Fallback to empty array if courses not passed yet
    const sourceData = courses || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // PERFORMANCE: Initialize Intl objects ONCE outside the loop!
    const priceFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    const dateFormatter = new Intl.DateTimeFormat(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric' });
    const startPrefix = sectionData?.start_prefix || "Start";

    return sourceData
      .filter((c) => {
        if (c.type !== filter) return false;
        if (c.endDate) {
          const end = new Date(c.endDate);
          if (end < today) return false;
        }
        return true;
      })
      .sort((a, b) => {
        return (a.sortOrder ?? 100) - (b.sortOrder ?? 100);
      })
      .map((course) => {
      // Pre-calculate derived data here to keep props stable
      const sessions = course.sessions;
      const formattedSchedule = sessions.map((s) => {
        const dayKey = s.day.toLowerCase();
        const localizedDay = t_days?.[dayKey] || s.day;
        if (s.isAlternating && s.altStartTime) {
          return `${localizedDay} ${s.startTime} & ${s.altStartTime} (${t_labels?.alternating || 'Wechsel'})`;
        }
        return `${localizedDay} ${s.startTime}-${s.endTime}`;
      });

      const formattedPrice = priceFormatter.format(course.price);

      let computedStartBadge = undefined;
      if (course.startDate) {
        const start = new Date(course.startDate);
        if (start > today) {
          computedStartBadge = `${startPrefix}: ${dateFormatter.format(start)}`;
        }
      }

      return {
        ...course,
        formattedSchedule,
        formattedPrice,
        computedStartBadge
      };
    });
  }, [filter, courses, t_days, localeTag, sectionData, t_labels]);

  if (!sectionData || !courseTexts) return null;

  return (
    <section
      id="courses"
      className="relative py-24 md:py-32 bg-transparent text-[#2D3436] dark:text-[#E2D7CE] overflow-hidden"
    >

      <div className="container mx-auto px-6 md:px-12 relative z-10">

        {/* --- Header / Toggle Section --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-20 md:mb-32">

          {/* Headline - High Contrast & Authority */}
          <div className="text-center md:text-left">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-[#FF5C00]/30 bg-[#FF5C00]/5 backdrop-blur-md">
                <span className="font-mono text-[10px] tracking-[0.3em] text-[#FF5C00] uppercase font-bold">
                  {sectionData.label_small}
                </span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase text-[#111111] dark:text-[#E2D7CE] leading-none">
              {sectionData.headline.line1} <br />
              <span className="text-[#FF5C00]">{sectionData.headline.line2}</span>
            </h2>
          </div>

          {/* The Glassmorphism Toggle Switch */}
          <div className="bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-md border border-white/40 dark:border-white/10 p-2 rounded-full flex relative shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] h-[60px] items-center">
            {(["presence", "online"] as const).map((tab) => {
              const isActive = filter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => startTransition(() => setFilter(tab))}
                  className={`
                    relative z-10 px-8 h-full rounded-full 
                    text-sm font-bold uppercase tracking-widest 
                    transition-colors duration-300 flex items-center justify-center
                    ${isActive
                      ? "text-[#1A1A1A] dark:text-[#1A1A1A]"
                      : "text-[#2D3436]/60 hover:text-[#2D3436] dark:text-white/60 dark:hover:text-white"
                    }
                    ${isPending ? "opacity-80" : ""}
                    ${jetbrainsMono.className}
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#FF5C00] rounded-full shadow-[0_2px_10px_rgba(255,92,0,0.4)]"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10">{sectionData.tabs[tab]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Syllabus Grid (Butter Smooth Performance) --- */}
        <div className="relative w-full">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={filter}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 pl-px pt-px"
            >
              {displayedCourses.map((courseConfig) => {
                const dictTextData = {...courseText(courseConfig,lang),level:courseConfig.level??'',location:''};
                // Fallback struct so we don't break if neither exists (though we shouldn't render null entirely if possible)
                if (!dictTextData && !courseConfig.title) return null;

                // Merge the dictionary text data with the dynamic title
                const textData = {
                  ...(dictTextData || {}),
                  title: dictTextData?.title || courseConfig.title || courseConfig.translationKey,
                } as CourseText;

                return (
                  <CourseCard
                    key={courseConfig.id}
                    config={courseConfig}
                    text={textData}
                    formattedSchedule={courseConfig.formattedSchedule}
                    formattedPrice={courseConfig.formattedPrice}
                    educatorName={t_instructors?.[courseConfig.instructor] || courseConfig.instructor}
                    dictionary={dictionary}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>


        {/* --- Footer Rule --- */}
        <div className="mt-20 border-t border-[#2D3436]/10 dark:border-white/10 pt-8 flex justify-center">
          <p className={`
              ${jetbrainsMono.className} 
              text-xs opacity-60 text-center max-w-lg
            `}>
            {sectionData.footer_note}
          </p>
        </div>

      </div>
    </section>
  );
}

// --- Component: Academic Index Card (Final Accessible Version) ---
interface CourseCardProps {
  config: CourseConfig & { computedStartBadge?: string };
  text: CourseText;
  formattedSchedule: string[];
  formattedPrice: string;
  educatorName: string;
  dictionary: Dictionary;
}

const CourseCard = React.memo(({ config, text, formattedSchedule, formattedPrice, educatorName, dictionary }: CourseCardProps) => {
  const params = useParams();
  const lang = (params?.lang as string) || "de";
  const isPrivate = config.category === 'private';

  // Infer unit based on price/duration or fallback
  // Strictly use config duration
  const unit = `/ ${config.unitDuration} min`;

  const trialCtaText = dictionary?.courses_v2?.trial_cta || "★ Kostenlose Probestunde";

  return (
    <motion.div
      variants={cardVariants}
      className={cn("group/card relative h-full flex flex-col rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-500 ease-out hover:z-20 hover:-translate-y-2 border",
        isPrivate
          ? "bg-gradient-to-br from-rose-500/5 via-purple-500/5 to-cyan-500/5 dark:from-rose-500/10 dark:via-purple-500/10 dark:to-cyan-500/10 border-purple-200/50 dark:border-purple-500/30 hover:border-purple-300 dark:hover:border-purple-400 shadow-[0_8px_30px_rgba(168,85,247,0.1)] before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-br before:from-pink-500/10 before:via-purple-500/10 before:to-indigo-500/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-700"
          : "bg-white/60 dark:bg-[#1a1a1a]/60 border-white/40 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]"
      )}
    >
      {/* Ambient hover glow inside card (Premium Mouse Tracking) */}
      <MouseGlow color="rgba(251,146,60,0.15)" />

      {/* Main Card Area → Regular Registration */}
      <Link
        href={`/${lang}/registration?courseId=${config.id}`}
        className={`
            group relative w-full flex-1 min-h-[380px] 
            bg-transparent
            cursor-pointer
            block
            
            flex flex-col justify-between overflow-hidden
            transition-all duration-300 ease-out
          `}
      >

        {/* Content Container */}
        <div className="relative z-10 flex flex-col h-full justify-between">

          {/* Header Area */}
          <div className="bg-black/[0.02] dark:bg-white/[0.02] p-7 pb-6 border-b border-black/5 dark:border-white/5">
            <div className="flex justify-between items-start mb-6">
              {/* Level Badge */}
              {text.level ? (
                <span className={`
                      ${jetbrainsMono.className} 
                      inline-block px-3 py-1 
                      border border-[#2D3436] dark:border-[#E2D7CE]
                      text-[#2D3436] dark:text-[#E2D7CE]
                      text-[10px] font-bold uppercase tracking-wider
                      group-hover:border-[#FF5C00] group-hover:text-[#FF5C00]
                      transition-colors duration-300
                    `}>
                  {text.level}
                </span>
              ) : <div />}

              {/* Start Badge - ONLY restricted logic or from text */}
              {(text.start_badge || config.computedStartBadge) && (
                <span className={`
                      ${jetbrainsMono.className}
                      bg-[#FF5C00] text-white
                      px-3 py-1 md:px-4 md:py-1.5
                      text-[10px] md:text-xs font-black uppercase tracking-widest
                      shadow-[0_4px_14px_rgba(255,92,0,0.4)]
                      dark:shadow-[0_4px_20px_rgba(255,92,0,0.6)]
                      rounded-sm ring-1 ring-[#FF5C00]/50 dark:ring-[#FF5C00]
                    `}>
                  {config.computedStartBadge || text.start_badge}
                </span>
              )}
            </div>

            <h3 className={`
                  font-sans font-extrabold tracking-tight
                  text-2xl xl:text-3xl leading-[1.1]
                  text-[#111111] dark:text-[#E2D7CE]
                `}>
              {text.title}
            </h3>
          </div>

          {/* Body Area */}
          <div className="p-7 pt-6 flex-1 flex flex-col justify-between">
            {/* Description - De-emphasize on hover */}
            <p className="text-[#2D3436]/70 dark:text-[#E2D7CE]/70 leading-relaxed text-sm font-medium pr-4 group-hover:opacity-50 transition-opacity duration-300">
              {text.description}
            </p>

            {/* Accessible Meta-Data Block */}
            <div className="mt-8">
              {/* Educator Row (Top of Footer Section) */}
              <div className="mb-6 pt-6 border-t border-[#2D3436]/10 dark:border-white/10">
                <div className="flex items-center gap-3 text-[#2D3436]/70 dark:text-[#E2D7CE]/70 group-hover:text-[#2D3436] dark:group-hover:text-[#E2D7CE] transition-all duration-300 group-hover:font-bold">
                  <User strokeWidth={1.5} size={16} className="text-black/30 dark:text-white/30" />
                  <span className={`${jetbrainsMono.className} text-sm font-medium uppercase tracking-wider`}>
                    {educatorName}
                  </span>
                </div>
              </div>

              {/* Price & Schedule Layout (Bottom Row) */}
              <div className="flex items-end justify-between text-[#2D3436] dark:text-[#E2D7CE]">

                {/* LEFT: Schedule (Time Block) */}
                <div className="relative flex items-center gap-3 text-[#2D3436]/70 dark:text-[#E2D7CE]/70 group-hover:text-[#1A1A1A] dark:group-hover:text-white transition-all duration-300 group-hover:font-bold pb-1">
                  {/* Marker */}
                  <div className="absolute -left-3 top-1 w-1 h-3 bg-[#FF5C00] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />

                  <Clock strokeWidth={1.5} size={16} className="shrink-0 text-black/30 dark:text-white/30 self-start mt-0.5" />
                  <div className={`${jetbrainsMono.className} flex flex-col gap-0.5 text-sm font-medium uppercase tracking-wider leading-tight max-w-[140px]`}>
                    {formattedSchedule.map((item, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-[#FF5C00]">&</span>}
                        <span>{item}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* RIGHT: Price & Unit (Cost Block) */}
                <div className="flex flex-col items-end">
                  {/* Price */}
                  <span className={`
                                font-sans font-extrabold tracking-tight
                                text-5xl 
                                group-hover:text-[#FF5C00] transition-all duration-300 leading-none
                            `}>
                    {formattedPrice}
                  </span>

                  {/* Unit */}
                  <span className={`
                      ${jetbrainsMono.className} 
                      text-[10px] text-[#2D3436]/50 dark:text-[#E2D7CE]/50 uppercase tracking-widest mt-1
                      group-hover:text-[#FF5C00] group-hover:font-bold group-hover:opacity-100
                      transition-all duration-300
                    `}>
                    {unit}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Bottom CTA Strip → Registration in Trial or Normal Mode */}
      <Link
        href={`/${lang}/registration?courseId=${config.id}${config.trialLessons !== false ? '&trial=1' : ''}`}
        className={`
          group/trial relative block w-full
          bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-md
          border-t border-t-white/20 dark:border-t-white/5
          group-hover/card:border-t-white/40
          px-7 py-5
          transition-all duration-500 ease-out
          hover:bg-[#FF5C00] dark:hover:bg-[#FF5C00]
        `}
      >
        <div className="flex items-center justify-center gap-2">
          {config.trialLessons !== false ? (
            <Gift
              size={14}
              strokeWidth={2}
              className="text-[#FF5C00] group-hover/trial:text-white transition-colors duration-300"
            />
          ) : (
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="text-[#FF5C00] group-hover/trial:text-white transition-colors duration-300 group-hover/trial:translate-x-1"
            />
          )}
          <span className={`
            ${jetbrainsMono.className}
            text-[11px] font-bold uppercase tracking-widest
            text-[#FF5C00] group-hover/trial:text-white
            transition-colors duration-300
          `}>
            {config.trialLessons !== false ? trialCtaText : (((dictionary as any)?.sections?.courses?.labels?.book_now) || "JETZT BUCHEN")}
          </span>
        </div>
      </Link>
    </motion.div>
  );
});
CourseCard.displayName = 'CourseCard';