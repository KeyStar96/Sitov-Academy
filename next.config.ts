import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PERFORMANCE: Compiler-Optimierungen
  compiler: {
    // Entferne console.log in Production (spart Bundle-Größe und CPU).
    // `console.error` und `console.warn` bleiben erhalten: Sie sind laut
    // Projektregeln die Grundlage für serverseitiges Logging, und ohne sie
    // lässt sich ein Fehler in Produktion nicht mehr nachvollziehen.
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // PERFORMANCE: Aktiviere React Strict Mode nur in Development
  reactStrictMode: process.env.NODE_ENV !== "production",

  // PERFORMANCE: Optimiere Image-Handling
  images: {
    // Moderne Formate bevorzugen
    formats: ["image/avif", "image/webp"],
    // Minimale Cache-Zeit für statische Bilder
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 Tage
    // Device-Sizes für responsive Images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image-Sizes für Thumbnails
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Qualities
    qualities: [75, 90],
  },

  // PERFORMANCE: Experimentelle Optimierungen
  experimental: {
    cpus: 2,
    // Optimized Package Imports - reduziert Bundle-Größe drastisch
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "gsap",
      "@gsap/react",
    ],
  },

  // PERFORMANCE: Turbopack-Konfiguration (Next.js 16 Standard)
  // Leere Konfiguration aktiviert Turbopack ohne Webpack-Fehler
  turbopack: {},

  // PERFORMANCE: Headers für besseres Caching
  async headers() {
    return [
      {
        // Cache statische Assets aggressiv
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JS/CSS mit Revalidierung
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // PERFORMANCE: Kompression aktivieren (falls nicht vom Server bereitgestellt)
  compress: true,

  // PERFORMANCE: Powered-By Header entfernen (minimal, aber spart Bytes)
  poweredByHeader: false,

  // PERFORMANCE: Strict Mode für bessere Fehlererkennung in Dev
  typescript: {
    // Type-Checking im Build (fängt Fehler früh ab)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

