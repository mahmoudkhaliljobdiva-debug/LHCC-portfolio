import type { LearningCatalog } from "@/types/learning-catalog";

export type CatalogMaterial = LearningCatalog[number]["materials"][number];

/** One shared classification for the public and Student specialty hubs. */
export function groupLearningMaterials(materials: readonly CatalogMaterial[]) {
  return [
    { key: "SUBJECT", title: "Subjects", materials: materials.filter(item => item.materialKind === "SUBJECT") },
    ...(["COLLOQUIUM", "PROMETRIC", "OTHER"] as const).map(category => ({
      key: category,
      title: category === "COLLOQUIUM" ? "Colloquium Exams" : category === "PROMETRIC" ? "Prometric Exams" : "Other Exams",
      materials: materials.filter(item => item.materialKind === "EXAM_TRACK" && item.examCategory === category),
    })),
  ].filter(group => group.materials.length > 0);
}
