import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.9fr_1.1fr]">
      <div className="flex flex-col px-6 py-6 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-16">{children}</div>
      </div>
      <div className="hidden bg-[#304f60] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm font-semibold tracking-[0.16em] text-teal-200 uppercase">L.H.C.C learning cloud</p>
        <blockquote className="max-w-xl text-4xl leading-tight font-medium tracking-tight">
          “Clarity turns practice into progress—and progress into confidence.”
        </blockquote>
        <p className="text-sm text-sky-100">Frontend demonstration · No authentication is performed</p>
      </div>
    </main>
  );
}
