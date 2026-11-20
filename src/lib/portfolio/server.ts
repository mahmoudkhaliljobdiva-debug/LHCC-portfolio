import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { portfolioContentSchema } from "@/lib/validation/portfolio";
import type { PortfolioContent, PortfolioSectionKey } from "@/types/portfolio-content";

export const getPortfolioContent = cache(async (): Promise<PortfolioContent | null> => {
  const supabase = await createClient();
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
});
