/** Most-specific route wins; dashboard roots must not match every child page. */
export function activeNavigationIndex(pathname: string, hrefs: readonly string[]): number {
  const path = pathname.startsWith("/student/banks/") ? "/student/question-banks" : pathname;
  return hrefs.reduce((best, href, index) => {
    const matches = path === href || (href.split("/").length > 2 && path.startsWith(`${href}/`));
    return matches && (best < 0 || href.length > hrefs[best]!.length) ? index : best;
  }, -1);
}
