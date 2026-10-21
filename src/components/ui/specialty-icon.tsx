import { Activity, ClipboardPlus, GraduationCap, Microscope, Pill, ScanLine, Stethoscope } from "lucide-react";
import type { Specialty } from "@/types/learning-catalog";
const icons = { nursing: ClipboardPlus, medical: Stethoscope, pharmacy: Pill, laboratory: Microscope, radiology: ScanLine, physiotherapy: Activity, other: GraduationCap };
export function SpecialtyIcon({ icon, className = "size-6 motion-safe:transition-transform motion-safe:group-hover:scale-110" }: { icon: Specialty["icon"]; className?: string }) {
  // Local SVG fallback; no remote animation script or unlicensed asset.
  if (icon === "dentistry") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M12 4c-3-2-7-1-7 3 0 3 1 4 1 7 0 3 1 6 3 6 1 0 1-6 3-6s2 6 3 6c2 0 3-3 3-6 0-3 1-4 1-7 0-4-4-5-7-3Z"/><path d="m9 3 3 1 3 2"/></svg>;
  const Icon = icons[icon]; return <Icon className={className} aria-hidden="true" />;
}
