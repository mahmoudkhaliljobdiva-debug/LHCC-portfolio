import type { Metadata, Viewport } from "next";
import { themeBootstrap } from "@/lib/theme";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lhcc-lb.com"),
  title: {
    default: "L.H.C.C | Healthcare Learning",
    template: "%s | L.H.C.C",
  },
  description:
    "Lebanese Health & Competence Center — healthcare learning for students, educators, and institutions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: "#f8f7f2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
