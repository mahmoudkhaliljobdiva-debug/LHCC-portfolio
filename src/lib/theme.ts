/** Only the appearance preference is stored locally; never business data. */
export type Theme = "light" | "dark";
export const THEME_KEY = "lhcc-theme";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme === "dark" ? "dark" : "only light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#10232e" : "#f8f7f2");
}

function savedTheme(): Theme | null {
  const temporary = document.documentElement.dataset.themePreference;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* Use this document's explicit choice when storage is unavailable. */ }
  return temporary === "dark" || temporary === "light" ? temporary : null;
}

export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    applyTheme(savedTheme() ?? (media.matches ? "dark" : "light"));
    onChange();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) {
      delete document.documentElement.dataset.themePreference;
      sync();
    }
  };
  media.addEventListener("change", sync);
  window.addEventListener("storage", storage);
  window.addEventListener("lhcc-theme-change", onChange);
  return () => {
    media.removeEventListener("change", sync);
    window.removeEventListener("storage", storage);
    window.removeEventListener("lhcc-theme-change", onChange);
  };
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.themePreference = theme;
  applyTheme(theme);
  // Restricted/private browsing must not break the toggle.
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Preference remains active for this document. */ }
  window.dispatchEvent(new Event("lhcc-theme-change"));
}

// Runs before first paint, including when storage access is blocked.
export const themeBootstrap = `(()=>{let saved;try{saved=localStorage.getItem("${THEME_KEY}")}catch{}const theme=saved==="light"||saved==="dark"?saved:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",theme==="dark");document.documentElement.style.colorScheme=theme==="dark"?"dark":"only light";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#10232e":"#f8f7f2")})();`;
