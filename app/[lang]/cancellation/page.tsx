import React from "react";
import Header from "@/components/layout/Header";
import { getDictionary } from "@/lib/dictionary";
import CancellationForm from "@/components/cancellation/CancellationForm";
import { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCourses } from '@/app/actions/get-courses';
import { courseText } from '@/lib/business-courses';

export async function generateStaticParams() {
    return [
        { lang: 'de' }, { lang: 'en' }, { lang: 'uk' }, { lang: 'ru' }, { lang: 'tr' },
    ];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: string }>;
}): Promise<Metadata> {
    const { lang } = await params;
    const dictionary = await getDictionary(lang);

    return {
        title: `${dictionary.cancellation.title} | Sitov Academy`,
        description: dictionary.cancellation.description,
        alternates: {
            canonical: `https://www.sitov-academy.com/${lang}/cancellation`,
            languages: {
                'x-default': `https://www.sitov-academy.com/de/cancellation`,
                de: `https://www.sitov-academy.com/de/cancellation`,
                en: `https://www.sitov-academy.com/en/cancellation`,
                uk: `https://www.sitov-academy.com/uk/cancellation`,
                ru: `https://www.sitov-academy.com/ru/cancellation`,
                tr: `https://www.sitov-academy.com/tr/cancellation`,
            },
        },
    };
}

export default async function CancellationPage({
    params,
}: {
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;
    const dictionary = await getDictionary(lang);
    const t = dictionary.cancellation;
    const courses = (await getCourses()).map(course => ({ id: course.id, title: courseText(course, lang).title }));

    return (
        <>
            <Header lang={lang} dictionary={dictionary} />

            <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 pt-28 md:pt-32">
                <div className="w-full max-w-lg">
                    {/* Glass Card */}
                    <div className="bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] rounded-3xl p-6 md:p-10 relative overflow-hidden">
                        {/* Ambient Glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[radial-gradient(circle,rgba(251,146,60,0.1)_0%,transparent_70%)] rounded-full pointer-events-none" />

                        {/* Back Button */}
                        <div className="relative z-10 mb-8">
                            <Link href={`/${lang}`} className="inline-flex items-center px-4 py-2 bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full text-foreground/60 hover:text-[var(--accent-text)] hover:shadow-lg transition-all duration-300 gap-2 group">
                                <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                                <span className="text-[10px] font-bold tracking-widest uppercase font-mono">{dictionary.cancellation.back_home || "Back"}</span>
                            </Link>
                        </div>

                        {/* Header Section */}
                        <div className="mb-8 text-center space-y-4 relative z-10">


                            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                {t.title}
                            </h1>

                            <p className="text-[var(--muted)] text-sm leading-relaxed max-w-xs mx-auto">
                                {t.description}
                            </p>
                        </div>

                        {/* Form Component */}
                        <div className="relative z-10">
                            <CancellationForm dictionary={dictionary} lang={lang} courses={courses} />
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}
