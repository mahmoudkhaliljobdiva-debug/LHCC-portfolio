"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

export function ThemeToggle({ inverse = false }: { readonly inverse?: boolean }) {
  const theme = useSyncExternalStore<Theme>(
    (onStoreChange) => {
      window.addEventListener("lhcc-theme-change", onStoreChange);
      window.addEventListener("storage", onStoreChange);
      return () => {
        window.removeEventListener("lhcc-theme-change", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("lhcc-theme", nextTheme);
    window.dispatchEvent(new Event("lhcc-theme-change"));
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
          ? "grid size-10 place-items-center rounded-xl border border-white/20 text-white transition hover:bg-white/10"
          : "grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      }
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
