"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Type-safe dictionary interface
interface HeroDictionary {
  hero: {
    claim: string;
    subline: string;
    cta_primary: string;
    cta_secondary: string;
  };
}

interface HeroProps {
  dictionary: HeroDictionary;
  lang?: string;
}

export default function Hero({ dictionary, lang = 'de' }: HeroProps) {
  const container = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);

  // Refs for masked reveal targets
  const brandRef = useRef<HTMLHeadingElement>(null);
  const sitovRef = useRef<HTMLSpanElement>(null);
  const languageRef = useRef<HTMLSpanElement>(null);
  const academyRef = useRef<HTMLSpanElement>(null);
  const claimRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Magnetic quickTo refs (stable across renders)
  const sitovQuickX = useRef<gsap.QuickToFunc | null>(null);
  const sitovQuickY = useRef<gsap.QuickToFunc | null>(null);
  const languageQuickX = useRef<gsap.QuickToFunc | null>(null);
  const languageQuickY = useRef<gsap.QuickToFunc | null>(null);
  const academyQuickX = useRef<gsap.QuickToFunc | null>(null);
  const academyQuickY = useRef<gsap.QuickToFunc | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [canHover, setCanHover] = useState(false);

  // Text Content
  const claimText = dictionary.hero.claim || "Spracherwerb durch Wissenschaft.";

  useEffect(() => {
    // Detect hover capability (desktop)
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover)").matches);
      
      const handlePreloader = () => setIsLoaded(true);
      window.addEventListener('preloader-complete', handlePreloader);
      
      // Fallback in case preloader isn't there or already fired
      const fallbackTimer = setTimeout(handlePreloader, 3000);

      return () => {
        window.removeEventListener('preloader-complete', handlePreloader);
        clearTimeout(fallbackTimer);
      };
    }
  }, []);

  // ─────────────────────────────────────────────
  // 1. CINEMATIC MASKED REVEAL (Load Animation)
  // 2. SCROLL PARALLAX (2.5D Depth)
  // 3. MAGNETIC HEADLINE quickTo setup
  // ─────────────────────────────────────────────
  useGSAP(() => {
    if (!isLoaded || !container.current) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Masked Reveal Timeline ──────────────────
    const revealTargets = [
      { el: brandRef.current, delay: 0 },
      { el: claimRef.current, delay: 0.15 },
      { el: sublineRef.current, delay: 0.30 },
      { el: ctaRef.current, delay: 0.45 },
    ];

    if (prefersReduced) {
      // Instant show for accessibility
      revealTargets.forEach(({ el }) => {
        if (el) {
          const inner = el.querySelector(".hero-line-inner") as HTMLElement | null;
          if (inner) gsap.set(inner, { yPercent: 0 });
          gsap.set(el, { autoAlpha: 1 });
        }
      });
    } else {
      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
        onComplete: () => {
          // After reveal finishes, allow overflow so magnetic drift doesn't clip
          if (brandRef.current) {
            brandRef.current.style.overflow = 'visible';
          }
        }
      });

      revealTargets.forEach(({ el, delay }) => {
        if (!el) return;
        const inner = el.querySelector(".hero-line-inner") as HTMLElement | null;
        if (inner) {
          // Inner slides up from below the mask
          tl.fromTo(
            inner,
            { yPercent: 110 },
            { yPercent: 0, duration: 1.2 },
            delay
          );
        }
        // Also ensure visibility
        tl.set(el, { autoAlpha: 1 }, delay);
      });
    }

    // ── Scroll Parallax ─────────────────────────
    if (!prefersReduced) {
      const parallaxPairs: [React.RefObject<HTMLElement | null>, number, number][] = [
        [brandRef, -50, 1],       // slow
        [claimRef, -100, 1],      // medium
        [sublineRef, -150, 1],    // fast
        [ctaRef, -80, 0],         // medium + fade out
      ];

      parallaxPairs.forEach(([ref, yEnd, opacityEnd]) => {
        if (!ref.current) return;
        gsap.to(ref.current, {
          y: yEnd,
          opacity: opacityEnd,
          ease: "none",
          scrollTrigger: {
            trigger: container.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });
    }

    // ── Magnetic Headline quickTo Setup ──────────
    if (canHover && !prefersReduced && sitovRef.current && languageRef.current && academyRef.current) {
      sitovQuickX.current = gsap.quickTo(sitovRef.current, "x", { duration: 0.6, ease: "power3.out" });
      sitovQuickY.current = gsap.quickTo(sitovRef.current, "y", { duration: 0.6, ease: "power3.out" });
      languageQuickX.current = gsap.quickTo(languageRef.current, "x", { duration: 0.6, ease: "power3.out" });
      languageQuickY.current = gsap.quickTo(languageRef.current, "y", { duration: 0.6, ease: "power3.out" });
      academyQuickX.current = gsap.quickTo(academyRef.current, "x", { duration: 0.6, ease: "power3.out" });
      academyQuickY.current = gsap.quickTo(academyRef.current, "y", { duration: 0.6, ease: "power3.out" });
    }

    // Cleanup ScrollTriggers on unmount
    return () => {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === container.current) st.kill();
      });
    };
  }, { scope: container, dependencies: [isLoaded, canHover] });

  // ─────────────────────────────────────────────
  // MOUSE HANDLERS (Magnetic + Hover Pop)
  // ─────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!canHover || !container.current) return;
    const rect = container.current.getBoundingClientRect();
    // Normalise mouse to -1..1 from center
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    const factor = 12; // max pixel offset
    // "Sitov" follows, "Language" slight, "Academy" mirrors → depth illusion
    sitovQuickX.current?.(nx * factor);
    sitovQuickY.current?.(ny * factor * 0.5);
    languageQuickX.current?.(nx * factor * 0.4);
    languageQuickY.current?.(ny * factor * 0.3);
    academyQuickX.current?.(nx * -factor);
    academyQuickY.current?.(ny * -factor * 0.5);
  }, [canHover]);

  const handleMouseLeave = useCallback(() => {
    // Reset to origin
    sitovQuickX.current?.(0);
    sitovQuickY.current?.(0);
    languageQuickX.current?.(0);
    languageQuickY.current?.(0);
    academyQuickX.current?.(0);
    academyQuickY.current?.(0);
  }, []);

  // Hover Pop handlers for brand line
  const handleBrandEnter = useCallback(() => {
    if (!canHover || !brandRef.current) return;
    gsap.to(brandRef.current, {
      scale: 1.02,
      skewX: -2,
      duration: 0.4,
      ease: "power2.out",
    });
  }, [canHover]);

  const handleBrandLeave = useCallback(() => {
    if (!canHover || !brandRef.current) return;
    gsap.to(brandRef.current, {
      scale: 1,
      skewX: 0,
      duration: 0.5,
      ease: "power2.inOut",
    });
  }, [canHover]);

  // Scroll Helper
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="hero"
      ref={container}
      className="relative min-h-[80vh] flex items-center overflow-hidden z-10 pt-12 pb-24 w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient glows fade in with the page so they don't flash under the curtain. */}
      <div
        className={cn(
          "pointer-events-none absolute top-[20%] left-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,92,0,0.15)_0%,transparent_60%)] transition-opacity duration-700 dark:bg-[radial-gradient(circle,rgba(255,92,0,0.08)_0%,transparent_60%)]",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-[-10%] right-[10%] -z-10 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,92,0,0.08)_0%,transparent_60%)] transition-opacity duration-700 dark:bg-[radial-gradient(circle,rgba(255,92,0,0.05)_0%,transparent_60%)]",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />

      {/* 12-Column Grid Container */}
      <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-30">

        {/* Left Spacer (Col 1) */}
        <div className="hidden lg:block lg:col-span-1" />

        {/* Text Content (Cols 2-8) */}
        <div
          ref={textContentRef}
          className="col-span-1 lg:col-span-7 flex flex-col justify-start text-left"
        >

          {/* ─── Block A: Brand Split (Masked Reveal) — 3 Lines ─── */}
          <h1
            ref={brandRef}
            className="hero-line-mask text-5xl sm:text-6xl md:text-8xl tracking-tighter leading-[0.85] font-sans mb-3"
            style={{ visibility: 'hidden' }}
            onMouseEnter={handleBrandEnter}
            onMouseLeave={handleBrandLeave}
          >
            <span className="hero-line-inner flex flex-col will-change-transform">
              <span
                ref={sitovRef}
                className="font-bold text-[#2D3436] dark:text-[#E2D7CE] inline-block will-change-transform"
              >
                Sitov
              </span>
              <span
                ref={languageRef}
                className="font-bold text-[#2D3436] dark:text-[#E2D7CE] inline-block will-change-transform"
              >
                Language
              </span>
              <span
                ref={academyRef}
                className="font-bold text-[#FF5C00] inline-block will-change-transform"
              >
                Academy
              </span>
            </span>
          </h1>

          {/* ─── Block B: Claim (Masked Reveal) ─── */}
          <h2
            ref={claimRef}
            className="hero-line-mask text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-[#111111]/80 dark:text-white/80 mb-6"
            style={{ visibility: 'hidden' }}
          >
            <span className="hero-line-inner block will-change-transform">
              {claimText}
            </span>
          </h2>

          {/* ─── Subline (Masked Reveal) ─── */}
          <p
            ref={sublineRef}
            className="hero-line-mask text-lg md:text-xl font-light tracking-wide leading-relaxed mb-6 max-w-xl text-[#2D3436] dark:text-[#E2D7CE] hyphens-none will-change-transform"
            style={{ visibility: 'hidden' }}
          >
            <span className="hero-line-inner block">
              {dictionary.hero.subline}
            </span>
          </p>

          {/* ─── CTAs (Masked Reveal) ─── */}
          <div
            ref={ctaRef}
            className="hero-line-mask flex flex-col sm:flex-row gap-4 items-start sm:items-center"
            style={{ visibility: 'hidden' }}
          >
            <span className="hero-line-inner flex flex-col sm:flex-row gap-4 will-change-transform">
              {/* Primary Button */}
              <button
                onClick={() => scrollToSection('science')}
                className="relative overflow-hidden group bg-[#FF5C00] text-white px-10 py-4 rounded-full font-mono text-xs uppercase tracking-widest transition-all duration-300 shadow-[0_8px_25px_rgba(255,92,0,0.3)] hover:shadow-[0_12px_35px_rgba(255,92,0,0.45)] hover:-translate-y-1 hover:bg-[#E65300]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span className="relative z-10">{dictionary.hero.cta_primary}</span>
              </button>

              {/* Secondary Button */}
              <button
                onClick={() => scrollToSection('courses')}
                className="group flex items-center gap-3 bg-white/60 dark:bg-[#1a1a1a]/60 backdrop-blur-xl border border-[#2D3436]/10 dark:border-white/10 text-[#2D3436] dark:text-[#E2D7CE] hover:text-[#FF5C00] dark:hover:text-[#FF5C00] hover:border-[#FF5C00]/30 hover:bg-white dark:hover:bg-[#111111] px-8 py-4 rounded-full transition-all duration-300 font-mono text-xs uppercase tracking-widest hover:-translate-y-1 shadow-[0_8px_25px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_35px_rgba(255,92,0,0.15)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <span>{dictionary.hero.cta_secondary}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </span>
          </div>
        </div>

        {/* Right Content / Whitespace (Cols 9-12) */}
        <div className="hidden lg:block lg:col-span-4"></div>
      </div>
    </section>
  );
}