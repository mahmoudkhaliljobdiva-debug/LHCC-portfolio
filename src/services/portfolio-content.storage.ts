import { DEFAULT_PORTFOLIO_CONTENT } from "@/data/portfolio-content.default";
import type { PortfolioContent } from "@/types/portfolio-content";

export const PORTFOLIO_CONTENT_STORAGE_KEY = "lhcc-portfolio-content";

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isPortfolioContent(value: unknown): value is PortfolioContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  for (const key of ["about", "services", "platform"] as const) {
    const section = candidate[key];
    if (!section || typeof section !== "object") return false;
    const page = section as Record<string, unknown>;
    if (
      !isText(page.subtitle) ||
      !isText(page.title) ||
      !isText(page.description) ||
      !isText(page.sectionHeading) ||
      !isText(page.buttonLabel) ||
      !Array.isArray(page.items) ||
      !page.items.every((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        return isText(record.id) && isText(record.title) && isText(record.description);
      })
    ) return false;
  }

  const contact = candidate.contact;
  if (!contact || typeof contact !== "object") return false;
  const contactPage = contact as Record<string, unknown>;
  return ["subtitle", "title", "description", "sectionHeading", "buttonLabel", "email", "phone", "address"]
    .every((key) => isText(contactPage[key]));
}

export function loadPortfolioContent(): PortfolioContent {
  if (typeof window === "undefined") return DEFAULT_PORTFOLIO_CONTENT;

  try {
    const saved = window.localStorage.getItem(PORTFOLIO_CONTENT_STORAGE_KEY);
    if (!saved) return DEFAULT_PORTFOLIO_CONTENT;
    const parsed: unknown = JSON.parse(saved);
    return isPortfolioContent(parsed) ? parsed : DEFAULT_PORTFOLIO_CONTENT;
  } catch {
    return DEFAULT_PORTFOLIO_CONTENT;
  }
}

export function savePortfolioContent(content: PortfolioContent): void {
  window.localStorage.setItem(PORTFOLIO_CONTENT_STORAGE_KEY, JSON.stringify(content));
}

export function resetPortfolioContent(): PortfolioContent {
  window.localStorage.removeItem(PORTFOLIO_CONTENT_STORAGE_KEY);
  return DEFAULT_PORTFOLIO_CONTENT;
}

