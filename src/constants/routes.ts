export const ROUTES = {
  public: {
    home: "/",
    about: "/about",
    services: "/services",
    platform: "/platform",
    contact: "/contact",
    login: "/login",
  },
  student: {
    dashboard: "/student",
    questionBanks: "/student/question-banks",
    exams: "/student/exams",
    analytics: "/student/analytics",
    profile: "/student/profile",
  },
  teacher: {
    dashboard: "/teacher",
    questions: "/teacher/questions",
    questionBanks: "/teacher/question-banks",
    exams: "/teacher/exams",
    students: "/teacher/students",
    analytics: "/teacher/analytics",
  },
  admin: {
    dashboard: "/admin",
    users: "/admin/users",
    questionBanks: "/admin/question-banks",
    wallet: "/admin/wallet",
    reports: "/admin/reports",
    settings: "/admin/settings",
  },
} as const;
