import { BookOpen, Brain, ClipboardCheck, GraduationCap, HeartPulse, Shapes, Smile, Stethoscope } from "lucide-react";
import type { MaterialIconName } from "@/types/material";

const icons = { book: BookOpen, brain: Brain, stethoscope: Stethoscope, nursing: HeartPulse, dentistry: Smile, graduation: GraduationCap, clipboard: ClipboardCheck, other: Shapes } as const;

export function MaterialIcon({ icon, className = "size-6" }: { icon: MaterialIconName; className?: string }) {
  const Icon = icons[icon] ?? icons.book;
  return <Icon className={className} aria-hidden="true" />;
}
