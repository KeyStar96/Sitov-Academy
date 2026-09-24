import { type Metadata } from "next";
import { Suspense } from "react";
import Hero from "@/components/sections/Hero";
import { getDictionary } from "@/lib/dictionary";
import Header from "@/components/layout/Header";

import AcademyStory from "@/components/sections/AcademyStory";
import AcademyCourses from "@/components/sections/AcademyCourses";
import AcademyFooter from "@/components/sections/AcademyFooter";
import PremiumCtaCard from "@/components/ui/PremiumCtaCard";
import AcademyFaq from "@/components/sections/AcademyFaq";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { OG_IMAGE, absoluteUrl, buildFaqPageJsonLd, buildPageMetadata, localizedUrl, serializeJsonLd } from "@/lib/seo";

const BASE_URL = CANONICAL_SITE_URL;

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return {
    ...buildPageMetadata({
      lang,
      path: '',
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      imageAlt: dictionary.meta.og_image_alt || dictionary.meta.title,
      absoluteTitle: true,
    }),
    keywords: dictionary.meta.keywords,
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
        "image": absoluteUrl(OG_IMAGE.path),
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
            "item": localizedUrl(lang),
          },
        ],
      },

      /* ── 5. FAQPage: identisch mit der sichtbaren FAQ-Sektion ── */
      buildFaqPageJsonLd(lang, dictionary.faq.items),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Header lang={lang} dictionary={dictionary} />

      <div className="academy-home">
        <Hero dictionary={dictionary} lang={lang} />
        <AcademyStory dictionary={dictionary} lang={lang} />
        <Suspense fallback={<section id="courses" className="academy-section academy-container min-h-[30rem]" aria-busy="true"><p role="status">{dictionary.academy.course_loading}</p></section>}>
          <AcademyCourses dictionary={dictionary} lang={lang} />
        </Suspense>
        <section className="academy-section academy-container">
          <PremiumCtaCard
            eyebrow={dictionary.academy.platform}
            title={dictionary.academy.learn_title}
            description={dictionary.academy.learn_description}
            ctaLabel={dictionary.academy.hero_secondary}
            href={`/${lang}/dashboard`}
          />
        </section>
        <AcademyFaq dictionary={dictionary} />
      </div>
      <AcademyFooter dictionary={dictionary} lang={lang} />
    </>
  );
}
