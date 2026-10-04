import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/icon.png", "/images/"],
      disallow: ["/admin", "/student", "/teacher", "/account", "/auth", "/api", "/login/", "/unauthorized"],
    },
    sitemap: "https://lhcc-lb.com/sitemap.xml",
  };
}
