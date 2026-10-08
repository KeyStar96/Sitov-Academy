import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/locale-routing';
import { INDEXABLE_PAGES, languageAlternates, localizedUrl } from '@/lib/seo';

/** Jede indexierbare Seite in jeder Sprache, jeweils mit vollständigem hreflang-Cluster inkl. `x-default`. */
export default function sitemap(): MetadataRoute.Sitemap {
    // Kein Build-/Abrufdatum als Inhaltsänderung ausgeben. lastModified kommt
    // erst hinzu, wenn das Datum einer echten Seitenänderung vorliegt.
    return INDEXABLE_PAGES.flatMap(page =>
        LOCALES.map(locale => ({
            url: localizedUrl(locale, page.path),
            changeFrequency: page.changeFrequency,
            priority: page.priority,
            alternates: { languages: languageAlternates(page.path) },
        }))
    );
}
