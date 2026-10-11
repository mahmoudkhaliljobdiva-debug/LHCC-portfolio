import { z } from "zod";
import { learningCatalogCopy } from "@/data/learning-copy";

const itemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(2000),
});

const pageSchema = z.object({
  subtitle: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  sectionHeading: z.string().trim().min(1).max(300),
  buttonLabel: z.string().trim().min(1).max(100),
  items: z.array(itemSchema).min(1).max(20),
});

const contactSchema = pageSchema.omit({ items: true }).extend({
  email: z.email().max(320),
  phone: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(500),
});

export const portfolioContentSchema = z.object({
  about: pageSchema,
  services: pageSchema.extend({ catalogHeading: z.string().trim().min(1).max(300).default(learningCatalogCopy.heading), catalogDescription: z.string().trim().min(1).max(5000).default(learningCatalogCopy.description) }),
  platform: pageSchema,
  contact: contactSchema,
});
