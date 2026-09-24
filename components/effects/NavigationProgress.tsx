"use client";

import { useEffect, useState, useRef } from "react";

/**
 * NavigationProgress — A slim top-of-page progress bar (like GitHub/YouTube)
 * that provides instant visual feedback during page transitions.
 *
 * Uses a MutationObserver on Next.js' internal <div id="__next-route-announcer__">
 * plus patching of history.pushState/replaceState as robust navigation detection.
 */
export default function NavigationProgress() {
    const [isNavigating, setIsNavigating] = useState(false);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Track clicks on internal links to start progress immediately
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            if (!href) return;

            // Only trigger for internal navigation (not external links, anchors, or same-page)
            const isInternal = href.startsWith("/") && !href.startsWith("//");
            const isAnchor = href.startsWith("#");
            const isSamePage = href === window.location.pathname;
            const isNewTab = anchor.target === "_blank";

            if (isInternal && !isAnchor && !isSamePage && !isNewTab) {
                startProgress();
            }
        };

        // Detect navigation completion via URL change (popstate + pushstate)
        const handleComplete = () => {
            completeProgress();
        };

        // Patch pushState/replaceState to detect programmatic navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(this, args);
            handleComplete();
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            handleComplete();
        };

        document.addEventListener("click", handleClick, { capture: true });
        window.addEventListener("popstate", handleComplete);

        return () => {
            document.removeEventListener("click", handleClick, { capture: true });
            window.removeEventListener("popstate", handleComplete);
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const startProgress = () => {
        // Clear any existing timers
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        setIsNavigating(true);
        setProgress(0);

        // Simulate progress: fast at first, then slows down
        let currentProgress = 0;
        intervalRef.current = setInterval(() => {
            currentProgress += (90 - currentProgress) * 0.08;
            if (currentProgress >= 89) {
                // Cap at 90% — completion happens when navigation finishes
                if (intervalRef.current) clearInterval(intervalRef.current);
                currentProgress = 90;
            }
            setProgress(currentProgress);
        }, 50);
    };

    const completeProgress = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        setProgress(100);

        // Hold at 100% briefly, then fade out
        timeoutRef.current = setTimeout(() => {
            setIsNavigating(false);
            setProgress(0);
        }, 300);
    };

    if (!isNavigating && progress === 0) return null;

    return (
        <div
            className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 z-[9999] h-[3px] pointer-events-none"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
        >
            <div
                className="h-full bg-[var(--accent-strong)] transition-all duration-200 ease-out"
                style={{
                    width: `${progress}%`,
                    opacity: progress >= 100 ? 0 : 1,
                    transition: progress >= 100
                        ? "width 150ms ease-out, opacity 300ms ease-out 150ms"
                        : "width 200ms ease-out",
                    boxShadow: "0 0 8px rgba(255, 92, 0, 0.6), 0 0 2px rgba(255, 92, 0, 0.8)",
                }}
            />
        </div>
    );
}
