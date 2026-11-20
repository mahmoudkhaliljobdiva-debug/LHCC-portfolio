"use client";

import { DashboardDataError } from "@/components/dashboard/data-error";

export default function StudentError({ reset }: { readonly reset: () => void }) {
  return <DashboardDataError reset={reset} />;
}
