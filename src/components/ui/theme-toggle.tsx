"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { setTheme, subscribeTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ inverse = false }: { readonly inverse?: boolean }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeTheme,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={
        inverse
          ? "lhcc-press grid size-11 shrink-0 place-items-center rounded-xl border border-white/20 text-white transition hover:bg-white/10"
          : "lhcc-press grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      }
    >
      <span key={theme} className="lhcc-icon-reveal grid place-items-center" aria-hidden="true">{isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</span>
    </button>
  );
}
