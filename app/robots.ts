import type { MetadataRoute } from 'next';
import { CANONICAL_SITE_URL } from '@/lib/site-url';

/**
 * robots.txt steuert nur das Crawling, nicht die Indexierung. Seiten, die nicht in
 * den Index sollen (Login, Registrierung des Kontos, Passwort), tragen deshalb
 * `noindex` und bleiben crawlbar – sonst sieht Google das `noindex` nie.
 * Die Kursanmeldung `/{lang}/registration` ist bewusst crawl- und indexierbar.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // Maschinen-Endpunkte und Einmal-Links aus E-Mails
                disallow: ['/api/', '/auth/'],
            },
        ],
        sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
        host: CANONICAL_SITE_URL,
    };
}
