import { cn } from "@/lib/utils";

/**
 * Globale Seitenleinwand – identisch mit dem Preloader (`--canvas`),
 * damit der Vorhang-Exit keine Farbkante erzeugt.
 *
 * Kein Verlauf mehr (der Dark-Mode-Indigo brach den Übergang).
 * Stattdessen: Sand/#050505, derselbe Orange-Glow und dasselbe Papier-Rauschen.
 */
export default function AppBackground({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                "absolute inset-0 z-0 h-full w-full overflow-hidden pointer-events-none select-none backface-hidden bg-[#FCF4E6] dark:bg-[#050505]",
                className
            )}
        >
            <div
                className={cn(
                    "absolute left-1/2 top-[42%] h-[min(70vw,28rem)] w-[min(70vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl",
                    "bg-[radial-gradient(circle,rgba(255,92,0,0.12)_0%,transparent_68%)]",
                    "dark:bg-[radial-gradient(circle,rgba(255,92,0,0.16)_0%,transparent_68%)]"
                )}
            />
            <div className="bg-noise-paper pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply dark:opacity-[0.12] dark:mix-blend-overlay" />
        </div>
    );
}
