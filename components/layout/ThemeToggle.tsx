"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme } from "@/lib/theme";

export default function ThemeToggle({
  lightLabel,
  darkLabel,
}: {
  lightLabel: string
  darkLabel: string
}) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    if (isDark === null) return;
    const newTheme = !isDark;
    applyTheme(newTheme ? "dark" : "light");
    try { localStorage.setItem("theme", newTheme ? "dark" : "light"); } catch { /* The selected theme remains active in this tab. */ }
  };

  if (isDark === null) {
    return <div className="h-11 w-11 shrink-0" aria-hidden="true" />;
  }

  const ariaLabel = isDark
    ? lightLabel
    : darkLabel;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="academy-icon-button"
      aria-label={ariaLabel}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
