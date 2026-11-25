import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { createPublicReadClient, getPublicContentRevision } from "@/lib/cache/public-content";
import { portfolioContentSchema } from "@/lib/validation/portfolio";
import type { PortfolioContent, PortfolioSectionKey } from "@/types/portfolio-content";

const getCachedPublishedPortfolio = unstable_cache(async (_revision: string): Promise<PortfolioContent | null> => {
  // Anonymous published-only rows. Never use an authenticated client in a
  // cross-request cache: its result might vary by user or cookie.
  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("portfolio_content")
    .select("section_key,content")
    .eq("published", true);

  if (error) throw new Error("Unable to load published portfolio content.");
  if (data.length === 0) return null;
  const content = Object.fromEntries(
    data.map((row) => [row.section_key as PortfolioSectionKey, row.content]),
  );
  const parsed = portfolioContentSchema.safeParse(content);
  if (!parsed.success) throw new Error("Published portfolio content is incomplete.");
  return parsed.data;
}, ["lhcc-published-portfolio-v1"], { revalidate: 120, tags: ["lhcc-public-content"] });

export const getPortfolioContent = cache(async () =>
  getCachedPublishedPortfolio(await getPublicContentRevision()),
);
