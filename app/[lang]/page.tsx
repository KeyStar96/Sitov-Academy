import { type Metadata } from "next";
import { Suspense } from "react";
import Hero from "@/components/sections/Hero";
import { getDictionary } from "@/lib/dictionary";
import Header from "@/components/layout/Header";

import AcademyStory from "@/components/sections/AcademyStory";
import AcademyCourses from "@/components/sections/AcademyCourses";
import AcademyFooter from "@/components/sections/AcademyFooter";

/* ─── Locale → OpenGraph locale mapping ─── */
const OG_LOCALE_MAP: Record<string, string> = {
  de: 'de_DE',
  en: 'en_US',
  uk: 'uk_UA',
  ru: 'ru_RU',
  tr: 'tr_TR',
};

const BASE_URL = "https://www.sitov-academy.com";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    keywords: dictionary.meta.keywords,
    robots: { index: true, follow: true },
    openGraph: {
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      url: `${BASE_URL}/${lang}`,
      siteName: "Sitov Academy",
      type: "website",
      locale: OG_LOCALE_MAP[lang] || 'de_DE',
      images: [{
        url: `${BASE_URL}/Bilder/og-sitov-academy.jpg`,
        width: 1200,
        height: 630,
        alt: dictionary.meta.og_image_alt || dictionary.meta.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      images: [`${BASE_URL}/Bilder/og-sitov-academy.jpg`],
    },
    alternates: {
      canonical: `${BASE_URL}/${lang}`,
      languages: {
        'x-default': `${BASE_URL}/de`,
        de: `${BASE_URL}/de`,
        en: `${BASE_URL}/en`,
        uk: `${BASE_URL}/uk`,
        ru: `${BASE_URL}/ru`,
        tr: `${BASE_URL}/tr`,
      },
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  /* ─── Rich JSON-LD: @graph with EducationalOrganization + Course + WebSite ─── */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      /* ── 1. Organization ── */
      {
        "@type": ["EducationalOrganization", "LocalBusiness"],
        "@id": `${BASE_URL}/#organization`,
        "name": "Sitov Academy",
        "alternateName": "Sitov Academy Hannover",
        "url": BASE_URL,
        "logo": `${BASE_URL}/Bilder/favicon.png`,
        "image": `${BASE_URL}/Bilder/og-sitov-academy.jpg`,
        "description": dictionary.meta.description,
        "email": "info@sitov-academy.com",
        "telephone": "+49 171 4758620",
        "priceRange": "€€",
        "currenciesAccepted": "EUR",
        "paymentAccepted": "Bank Transfer",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Vahrenwalder Str. 92",
          "addressLocality": "Hannover",
          "postalCode": "30165",
          "addressRegion": "Niedersachsen",
          "addressCountry": "DE",
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 52.3975,
          "longitude": 9.7380,
        },
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "09:00",
            "closes": "18:00",
          },
        ],
        "sameAs": [
          "https://t.me/smartgerman_hannover",
        ],
        "availableLanguage": [
          { "@type": "Language", "name": "German", "alternateName": "de" },
          { "@type": "Language", "name": "Russian", "alternateName": "ru" },
          { "@type": "Language", "name": "Ukrainian", "alternateName": "uk" },
          { "@type": "Language", "name": "English", "alternateName": "en" },
          { "@type": "Language", "name": "Turkish", "alternateName": "tr" },
        ],
        "founder": {
          "@type": "Person",
          "name": "Anastasia Sitov",
          "jobTitle": "M.Ed., DaF/DaZ",
        },
      },

      /* ── 2. Courses (JSON-LD removed from static generation to unblock HTML) ── */
      // We can rely on SSR/Suspense to inject SEO for courses, or keep it basic here.

      /* ── 3. WebSite ── */
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        "url": BASE_URL,
        "name": "Sitov Academy",
        "inLanguage": lang,
        "publisher": { "@id": `${BASE_URL}/#organization` },
      },

      /* ── 4. BreadcrumbList ── */
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Sitov Academy",
            "item": BASE_URL,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": dictionary.meta.title,
            "item": `${BASE_URL}/${lang}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header lang={lang} dictionary={dictionary} />

      <div className="academy-home">
        <Hero dictionary={dictionary} lang={lang} />
        <AcademyStory dictionary={dictionary} lang={lang} />
        <Suspense fallback={<section id="courses" className="academy-section academy-container min-h-[30rem]" aria-busy="true"><p role="status">{dictionary.academy.course_loading}</p></section>}>
          <AcademyCourses dictionary={dictionary} lang={lang} />
        </Suspense>
      </div>
      <AcademyFooter dictionary={dictionary} lang={lang} />
    </>
  );
}
