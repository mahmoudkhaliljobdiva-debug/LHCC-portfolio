import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "MedLumen | Healthcare Learning",
    template: "%s | MedLumen",
  },
  description:
    "A modern healthcare learning platform for students, educators, and institutions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

