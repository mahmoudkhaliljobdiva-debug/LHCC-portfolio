import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  ClipboardCheck,
  FileQuestion,
  Gauge,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";
import type { NavigationItem } from "@/types/navigation";
import type { UserRole } from "@/types/roles";

export const ROLE_NAVIGATION = {
  student: [
    { label: "Dashboard", href: ROUTES.student.dashboard, icon: Gauge },
    { label: "Question Banks", href: ROUTES.student.questionBanks, icon: BookOpen },
    { label: "Exams", href: ROUTES.student.exams, icon: ClipboardCheck },
    { label: "Wallet", href: ROUTES.student.wallet, icon: CircleDollarSign },
    { label: "Analytics", href: ROUTES.student.analytics, icon: BarChart3 },
    { label: "Profile", href: ROUTES.student.profile, icon: UserCircle },
  ],
  teacher: [
    { label: "Dashboard", href: ROUTES.teacher.dashboard, icon: Gauge },
    { label: "Questions", href: ROUTES.teacher.questions, icon: FileQuestion },
    { label: "Question Banks", href: ROUTES.teacher.questionBanks, icon: BookOpen },
    { label: "Exams", href: ROUTES.teacher.exams, icon: ClipboardCheck },
    { label: "Students", href: ROUTES.teacher.students, icon: Users },
    { label: "Analytics", href: ROUTES.teacher.analytics, icon: BarChart3 },
  ],
  admin: [
    { label: "Dashboard", href: ROUTES.admin.dashboard, icon: Gauge },
    { label: "Users", href: ROUTES.admin.users, icon: Users },
    { label: "Question Banks", href: ROUTES.admin.questionBanks, icon: BookOpen },
    { label: "Wallet", href: ROUTES.admin.wallet, icon: CircleDollarSign },
    { label: "Reports", href: ROUTES.admin.reports, icon: BarChart3 },
    { label: "Settings", href: ROUTES.admin.settings, icon: Settings },
  ],
} as const satisfies Record<UserRole, readonly NavigationItem[]>;

