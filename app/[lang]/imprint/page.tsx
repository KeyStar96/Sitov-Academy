import { getDictionary } from "@/lib/dictionary";
import AcademyFooter from "@/components/sections/AcademyFooter";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { Metadata } from "next";

export async function generateStaticParams() {
    return [
        { lang: 'de' }, { lang: 'en' }, { lang: 'uk' }, { lang: 'ru' }, { lang: 'tr' },
    ];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    const dictionary = await getDictionary(lang);
    return {
        title: dictionary.imprint?.title || "Imprint",
        description: dictionary.imprint?.title || "Imprint",
        alternates: {
            canonical: `https://www.sitov-academy.com/${lang}/imprint`,
            languages: {
                'x-default': `https://www.sitov-academy.com/de/imprint`,
                de: `https://www.sitov-academy.com/de/imprint`,
                en: `https://www.sitov-academy.com/en/imprint`,
                uk: `https://www.sitov-academy.com/uk/imprint`,
                ru: `https://www.sitov-academy.com/ru/imprint`,
                tr: `https://www.sitov-academy.com/tr/imprint`,
            },
        },
    };
}

export default async function ImprintPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    const dictionary = await getDictionary(lang);

    return (
        <div className="min-h-screen bg-transparent text-foreground font-sans selection:bg-primary-orange/30">
            <Header dictionary={dictionary} lang={lang} />

            <main className="container mx-auto px-4 pt-32 pb-16 max-w-4xl relative">
                <div className="mb-12">
                    <Link href={`/${lang}`} className="inline-flex min-h-12 items-center px-5 py-2.5 bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full text-foreground/60 hover:text-primary-orange hover:shadow-lg transition-all duration-300 gap-3 group">
                        <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-xs font-bold tracking-widest uppercase">{dictionary.registration?.back_home || "Zurück zur Startseite"}</span>
                    </Link>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-12 text-foreground">
                    {dictionary.imprint?.title || "Impressum"}
                </h1>

                <div className="space-y-8">
                    {dictionary.imprint?.sections?.map((section, index) => (
                        <section
                            key={index}
                            className={`relative overflow-hidden bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-md p-8 md:p-10 rounded-3xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 hover:shadow-xl hover:border-white/80 dark:hover:border-white/30`}
                        >
                            {/* Ambient Glow */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[radial-gradient(circle,rgba(251,146,60,0.1)_0%,transparent_70%)] rounded-full pointer-events-none" />
                            
                            <h2 className={`relative z-10 text-2xl font-bold tracking-tight mb-6 text-foreground`}>
                                {section.title}
                            </h2>
                            <div className={`relative z-10 space-y-4 text-foreground/70 leading-relaxed text-base md:text-lg`}>
                                {section.content.map((paragraph: string, pIndex: number) => (
                                    <p key={pIndex}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </main>

            <AcademyFooter dictionary={dictionary} lang={lang} />
        </div>
    );
}
