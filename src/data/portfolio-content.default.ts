import type { PortfolioContent } from "@/types/portfolio-content";

export const DEFAULT_PORTFOLIO_CONTENT = {
  about: {
    subtitle: "About L.H.C.C",
    title: "Better learning creates better care.",
    description:
      "We are building a calm, rigorous digital environment where healthcare learners and educators can focus on meaningful progress.",
    sectionHeading: "Designed around what matters",
    buttonLabel: "Explore the student demo",
    items: [
      { id: "about-clinical", title: "Clinically focused learning", description: "Learning experiences centered on practical healthcare competence." },
      { id: "about-analytics", title: "Clear and ethical analytics", description: "Useful progress signals presented with clarity and care." },
      { id: "about-accessible", title: "Accessible by design", description: "A responsive, inclusive platform built for every learner." },
    ],
  },
  services: {
    subtitle: "Our services",
    title: "Tools for every stage of medical learning.",
    description:
      "Structured practice, educator workflows, cohort insight, and institutional oversight—designed as one connected experience.",
    sectionHeading: "Learning support for every role",
    buttonLabel: "Explore our platform",
    items: [
      { id: "services-students", title: "Student preparation", description: "Focused practice and feedback for confident exam preparation." },
      { id: "services-educators", title: "Educator assessment tools", description: "Create, organize, and review meaningful learning activities." },
      { id: "services-institutions", title: "Institutional reporting", description: "See cohort progress and program performance in one place." },
    ],
  },
  platform: {
    subtitle: "The platform",
    title: "One workspace. Every learning signal.",
    description:
      "Move from focused question practice to assessment, feedback, and long-term performance trends without losing context.",
    sectionHeading: "A connected learning workspace",
    buttonLabel: "Open the platform demo",
    items: [
      { id: "platform-qbanks", title: "Reusable question banks", description: "Six structured medical banks powered by one reusable content system." },
      { id: "platform-exams", title: "Mock exams and assignments", description: "Purposeful assessment workflows for learners and educators." },
      { id: "platform-insight", title: "Progress and credit oversight", description: "Learning analytics for every role and credit oversight for administrators." },
    ],
  },
  contact: {
    subtitle: "Contact",
    title: "Let’s talk about better healthcare learning.",
    description:
      "Whether you represent a medical school, teaching team, or learning program, we would be glad to hear what you are building.",
    sectionHeading: "Get in touch",
    buttonLabel: "Send an email",
    email: "hello@lhcc.example",
    phone: "+961 1 555 014",
    address: "Beirut, Lebanon",
  },
} as const satisfies PortfolioContent;

