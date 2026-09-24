import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inter, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import SmoothScroll from "@/components/effects/SmoothScroll";
import { getDictionary } from "@/lib/dictionary";
import SupportNode from "@/components/layout/SupportNode";
import AppBackground from "@/components/effects/AppBackground";
import { AppearanceProvider } from "@/components/layout/AppearanceProvider";
import { ThemeInit } from "@/components/effects/ThemeInit";
import NavigationProgress from "@/components/effects/NavigationProgress";
import Preloader from "@/components/effects/Preloader";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import { RouteFeedbackProvider, type RouteFeedbackCopy } from "@/components/layout/RouteFeedbackProvider";
import ConsentManager from "@/components/analytics/ConsentManager";
import { CONSENT_BOOTSTRAP_SCRIPT } from "@/lib/analytics/consent";
import { CANONICAL_SITE_URL } from "@/lib/site-url";
import { LOCALES } from "@/lib/locale-routing";

/* ─── Global metadata defaults (inherited by all pages) ─── */
export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_SITE_URL),
  title: {
    template: '%s | Sitov Academy',
    default: 'Sitov Academy — Deutschkurse in Hannover',
  },
  description: 'Deutschkurse in Hannover für Ukrainer & Russischsprachige. A1-B2, Online & Präsenz.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/Bilder/favicon.png',
    shortcut: '/Bilder/favicon.png',
    apple: '/Bilder/favicon.png',
  },
};

// Inter: Variable-Font mit Kyrillisch (ru/uk) UND Latin-Extended (tr: ğ/ş/ı).
// next/font lädt zur Build-Zeit herunter und self-hosted — kein Client-Request an Google (DSGVO).
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  adjustFontFallback: true, // metrisch angepasster Fallback → minimiert CLS
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

// STATIC GENERATION (SSG)
// This tells Next.js to pre-build these routes at build time.
export async function generateStaticParams() {
  return LOCALES.map(lang => ({ lang }));
}

// Nur die fünf Sprachen existieren; jeden anderen Wert beantwortet das Layout
// unten mit notFound() (Crawling-Falle). Bewusst KEIN `dynamicParams = false`:
// Damit liefert Next.js nach jedem revalidatePath('/', 'layout') – also nach
// jeder An- oder Abmeldung – für ALLE statischen Seiten dauerhaft 404
// (NoFallbackError beim Neuaufbau).

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  /* iOS SAFARI EDGE-TO-EDGE:
   * themeColor set to exact footer dark color #121417
   * This blends the bottom bar area seamlessly
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' }, // slate-50 = --canvas hell
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },  // slate-900 = --canvas dunkel
  ],
};

// Wir machen die Funktion 'async'
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>; // Wir sagen TS, dass params ein Versprechen (Promise) ist
}) {
  // Hier "warten" wir auf die Sprache
  const { lang } = await params;
  // Dynamisch gerenderte Seiten (Login, Lernraum) prüfen `dynamicParams` nicht;
  // Pfade wie `/authx/login` umgehen die Middleware. Beides endet hier als 404.
  if (!(LOCALES as readonly string[]).includes(lang)) notFound();
  const dictionary = await getDictionary(lang);
  const feedback = ({ loading, error_title, error_description, error_retry }: RouteFeedbackCopy): RouteFeedbackCopy => ({ loading, error_title, error_description, error_retry });
  const feedbackMessages = {
    auth: feedback(dictionary.auth), vocabulary: feedback(dictionary.vocabulary),
    exercises: feedback(dictionary.exercises), videos: feedback(dictionary.videos),
    pronunciation: feedback(dictionary.pronunciation), profile: feedback(dictionary.profile),
  };

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* Standardized PWA - "Native App" Hack */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[var(--canvas)] text-[var(--foreground)] antialiased overflow-x-clip w-full`}>
        <a className="academy-skip-link" href="#main-content">{dictionary.academy.skip_content}</a>
        <Preloader label={dictionary.academy.preloader_label} name={dictionary.academy.brand_name} descriptor={dictionary.academy.brand_descriptor} />
        {/* Navigation progress bar — instant visual feedback during page transitions */}
        <NavigationProgress />
        {/* 
          CHROME FIX für backdrop-filter:
          - Hintergründe mit z-index: 0/1 statt negativen Werten
          - Main Content OHNE z-index, damit kein isolierter Stacking-Context entsteht
          - Das erlaubt backdrop-filter, die Hintergründe zu bluren
        */}

        {/* 
           LCP OPTIMIZATION + iOS SAFARI EDGE-TO-EDGE:
           - Background decoupled from Client Components (SmoothScroll/Pinner) is critical!
           - Position fixed keeps it in view without JS simulation
           - Z-Index -1 ensures it acts as background
           - Extended beyond safe areas for full physical screen coverage
           - Uses env() to extend into notch/Dynamic Island and home indicator areas
        */}
        <div
          className="fixed z-0 w-full h-full pointer-events-none"
          style={{
            /* Extend beyond safe areas for full edge-to-edge coverage */
            top: 'calc(-1 * env(safe-area-inset-top, 0px))',
            left: 'calc(-1 * env(safe-area-inset-left, 0px))',
            right: 'calc(-1 * env(safe-area-inset-right, 0px))',
            bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
            /* Ensure full coverage including the extended areas */
            width: 'calc(100% + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))',
            height: 'calc(100% + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <AppBackground />
        </div>

        <ThemeInit />

        {/* 3. Die oberste Ebene: Header (z-index: 50 für sticky) */}
        {/* Header moved to page.tsx */}

        {/* 4. Main Content: KEIN z-index damit backdrop-filter funktioniert! */}
        <AppearanceProvider copy={dictionary.accessibility}>
        <RouteFeedbackProvider messages={feedbackMessages} audio={dictionary.neural_audio}>
        <SmoothScroll>
          <main id="main-content" className="pt-0 scroll-3d-container min-h-screen relative">
            {children}
          </main>
        </SmoothScroll>
        </RouteFeedbackProvider>
        </AppearanceProvider>
        <SupportNode dictionary={dictionary} />
        {/* Meta-Pixel nur nach Opt-in; ohne Einwilligung kein Request an Meta. */}
        <ConsentManager lang={lang} copy={dictionary.consent} />
      </body>
    </html>
  );
}
