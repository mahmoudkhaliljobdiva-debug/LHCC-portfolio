export const PORTFOLIO_SECTIONS = ["about", "services", "platform", "contact"] as const;

export type PortfolioSectionKey = (typeof PORTFOLIO_SECTIONS)[number];

export interface PortfolioContentItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface PortfolioPageContent {
  readonly subtitle: string;
  readonly title: string;
  readonly description: string;
  readonly sectionHeading: string;
  readonly buttonLabel: string;
  readonly items: readonly PortfolioContentItem[];
}

export interface PortfolioContactContent {
  readonly subtitle: string;
  readonly title: string;
  readonly description: string;
  readonly sectionHeading: string;
  readonly buttonLabel: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
}

export interface PortfolioContent {
  readonly about: PortfolioPageContent;
  readonly services: PortfolioPageContent;
  readonly platform: PortfolioPageContent;
  readonly contact: PortfolioContactContent;
}

