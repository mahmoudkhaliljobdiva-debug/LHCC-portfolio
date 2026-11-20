/**
 * Formats the displayed course/question-bank access price.
 * This is presentation-only; zero remains a numeric value in the database.
 * Access still follows the existing administrator-approval workflow.
 */
export function formatAccessPrice(price: number): string {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}
