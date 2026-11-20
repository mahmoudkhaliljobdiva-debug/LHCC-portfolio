export function DashboardDataLoading() {
  return (
    <div role="status" aria-label="Loading workspace" className="animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-slate-200" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl border bg-white" />)}
      </div>
      <div className="mt-6 h-80 rounded-2xl border bg-white" />
    </div>
  );
}
