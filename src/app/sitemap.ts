import type { MetadataRoute } from "next";

import { PORTFOLIO_SECTIONS } from "@/types/portfolio-content";

const baseUrl = "https://lhcc-lb.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...PORTFOLIO_SECTIONS, "login", "signup"].map((path) => ({
    url: `${baseUrl}/${path}`,
  }));
}
