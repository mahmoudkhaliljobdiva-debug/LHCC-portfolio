import Link from "next/link";

export default function LoginPage() {
  return (
    <section className="w-full max-w-md">
      <p className="text-sm font-semibold text-teal-700">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Choose any demo portal below. No credentials are required.</p>
      <form className="mt-8 grid gap-5">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email address
          <input type="email" placeholder="you@institution.edu" className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Password
          <input type="password" placeholder="••••••••" className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" />
        </label>
        <Link href="/student" className="mt-1 rounded-xl bg-teal-700 px-5 py-3.5 text-center text-sm font-semibold text-white hover:bg-teal-800">
          Continue to demo
        </Link>
      </form>
      <div className="mt-7 grid grid-cols-3 gap-2">
        {["student", "teacher", "admin"].map((role) => (
          <Link key={role} href={`/${role}`} className="rounded-lg border px-3 py-2 text-center text-xs font-semibold capitalize text-slate-600 hover:bg-slate-50">
            {role}
          </Link>
        ))}
      </div>
    </section>
  );
}
