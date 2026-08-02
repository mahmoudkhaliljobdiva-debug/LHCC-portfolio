import type { Metadata } from "next";

import "@/app/globals.css";
import { PortfolioContentProvider } from "@/features/portfolio-content/portfolio-content-provider";

export const metadata: Metadata = {
  title: {
    default: "L.H.C.C | Healthcare Learning",
    template: "%s | L.H.C.C",
  },
  description:
    "Lebanese Health & Competence Center — healthcare learning for students, educators, and institutions.",
};

const themeScript = `
  try {
    const saved = localStorage.getItem("lhcc-theme");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><PortfolioContentProvider>{children}</PortfolioContentProvider></body>
    </html>
  );
}
