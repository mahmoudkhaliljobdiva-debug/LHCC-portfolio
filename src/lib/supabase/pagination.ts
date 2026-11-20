/** Exhaust a deterministically ordered query without silently using partial totals. */
export async function readAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  message = "Unable to load records.",
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (;;) {
    const { data, error } = await query(rows.length, rows.length + pageSize - 1);
    if (error || !data) throw new Error(message);
    if (data.length === 0) return rows;
    rows.push(...data);
    // Continue even after a short page: the server may enforce a smaller limit.
  }
}
