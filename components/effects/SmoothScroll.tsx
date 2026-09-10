"use client";

import { usePathname } from "next/navigation";
import { ReactLenis } from "lenis/react";
import { ReactNode, useMemo, useEffect, useState } from "react";

/**
 * SMOOTH SCROLL - MINIMAL & ADAPTIVE
 * 
 * DESIGN-PRINZIP:
 * - Natives Scrolling für Touch-Geräte (iOS/Android)
 *   → Apple's Momentum-Scrolling ist unschlagbar für UX
 * - Lenis NUR für Desktop-Browser (Chrome/Edge/Safari macOS)
 *   → Glättet das Mausrad-Scrolling
 * 
 * PERFORMANCE:
 * - KEINE Multiplikatoren über 1.0
 * - Sanfte Kurve ohne Overshoot
 * - Kurze Duration für direktes Feedback
 */

// Sanfte Easing-Kurve - kein Overshoot
const smoothEasing = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

// Device Detection
const isTouchDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
};

const isMobileOS = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
};

// macOS Detection (MacBook Trackpads / Magic Mouse already have perfect inertia)
const isMacOS = (): boolean => {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 || /macintosh|mac os x/i.test(navigator.userAgent);
};

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [useNativeScroll, setUseNativeScroll] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkScrollMode = () => {
      // Touch-Geräte, Mobile OS oder kleine Screens (< 1024px) → Natives Scrolling
      const isSmallScreen = window.innerWidth < 1024;

      if (isTouchDevice() || isMobileOS() || isMacOS() || isSmallScreen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setUseNativeScroll(true);
      } else {
        setUseNativeScroll(false);
      }
    };

    checkScrollMode();

    window.addEventListener('resize', checkScrollMode);
    return () => window.removeEventListener('resize', checkScrollMode);
  }, []);

  // Lenis-Optionen: Minimal & Performant
  const options = useMemo(() => ({
    // Kurze Duration für direktes Feedback
    duration: 0.8,
    easing: smoothEasing,

    // Nur Wheel smoothen, kein Touch
    smoothWheel: true,
    smoothTouch: false, // Natives Touch-Scrolling

    // KEINE Multiplikatoren über 1.0
    wheelMultiplier: 1.0,
    touchMultiplier: 1.0,

    // Kein Infinite Scroll
    infinite: false,

    // Vertikales Scrolling
    gestureOrientation: "vertical" as const,

    // Lenis managed den RAF
    autoRaf: true,

    // Niedriger Lerp für sanftere Bewegung ohne Ruckeln
    lerp: 0.1,
  }), []);

  // SSR: Render children direkt
  if (!mounted) {
    return <>{children}</>;
  }

  // Touch/Mobile: Natives Scrolling - kein Lenis
  if (useNativeScroll || pathname.includes("/dashboard") || pathname.includes("/admin")) {
    return <>{children}</>;
  }

  // Desktop: Lenis für Mausrad-Glättung
  return (
    <ReactLenis
      root
      options={options}
    >
      {children}
    </ReactLenis>
  );
}
