export function Progress({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-teal-600"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

