"use server";

import { revalidatePath } from "next/cache";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { getPortfolioContent } from "@/lib/portfolio/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { portfolioContentSchema } from "@/lib/validation/portfolio";
import type { PortfolioContent } from "@/types/portfolio-content";
import type { ServerResult } from "@/types/server-result";

export async function savePortfolioContent(input: PortfolioContent): Promise<ServerResult<PortfolioContent>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;
  const parsed = portfolioContentSchema.safeParse(input);
  if (!parsed.success) return failure("Please complete all required portfolio fields.");

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_portfolio_content", { payload: parsed.data as Json });
    if (error) return failure("Portfolio content could not be saved.");
    revalidatePortfolio();
    return { ok: true, data: await getPortfolioContent() };
  } catch {
    return failure("Portfolio content could not be saved.");
  }
}

export async function resetPortfolioContent(): Promise<ServerResult<PortfolioContent>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reset_portfolio_content");
    if (error) return failure("Default portfolio content could not be restored.");
    revalidatePortfolio();
    return { ok: true, data: await getPortfolioContent() };
  } catch {
    return failure("Default portfolio content could not be restored.");
  }
}

function revalidatePortfolio() {
  revalidatePath("/", "layout");
  for (const path of ["/about", "/services", "/platform", "/contact", "/admin/portfolio"]) revalidatePath(path);
}

function failure(message: string): ServerResult<never> {
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}
