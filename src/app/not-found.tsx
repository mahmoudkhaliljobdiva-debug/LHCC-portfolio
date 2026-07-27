import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-center">
      <div><p className="text-sm font-semibold text-teal-700">404</p><h1 className="mt-3 text-4xl font-semibold text-slate-950">Page not found</h1><p className="mt-3 text-slate-500">The page you requested does not exist in this demo.</p><Link href="/" className="mt-7 inline-block rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">Return home</Link></div>
    </main>
  );
}
