// Read-only production/local HTTP checks. No credentials, forms or backend writes.
import assert from "node:assert/strict";

const base = new URL(process.env.QA_BASE_URL ?? "https://lhcc-lb.com");
assert(["lhcc-lb.com", "lhcc-portfolio.vercel.app", "localhost", "127.0.0.1"].includes(base.hostname));
assert(!base.username && !base.password && base.pathname === "/");
const results = [];
const iconUrls = new Set([new URL("/favicon.ico", base).href, new URL("/icon.png", base).href]);
for (const path of ["/", "/about", "/services", "/platform", "/contact", "/programs/medical", "/programs/nursing", "/programs/dentistry", "/signup", "/login", "/robots.txt"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, 200, path);
  const body = await response.text();
  assert(!/Application error|Internal Server Error/.test(body), path);
  if (path === "/") {
    const tags = [...body.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => /\brel="(?:icon|apple-touch-icon)"/i.test(tag));
    assert(tags.length > 0, "Generated favicon metadata exists");
    for (const tag of tags) {
      const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
      assert(href, "Icon URL exists");
      const url = new URL(href.replaceAll("&amp;", "&"), base);
      assert.equal(url.origin, base.origin, "Only inspect same-origin icon assets");
      iconUrls.add(url.href);
    }
    results.push({ path, status: response.status, faviconMetadata: tags });
  } else if (path === "/robots.txt") {
    for (const role of ["admin", "student", "teacher"]) assert(body.includes(`Disallow: /${role}`), "Private portal crawler rule preserved");
    results.push({ path, status: response.status, privatePortalRules: true });
  } else results.push({ path, status: response.status });
}

for (const url of iconUrls) {
  const response = await fetch(url, { redirect: "manual" });
  assert.equal(response.status, 200, url);
  const mime = response.headers.get("content-type");
  assert(mime?.startsWith("image/"), "Valid public image MIME type");
  const bytes = Buffer.from(await response.arrayBuffer());
  let dimensions;
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) dimensions = [[bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
  else {
    assert(bytes.length >= 22 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1, "Valid ICO image header");
    const entries = bytes.readUInt16LE(4);
    assert(entries > 0 && bytes.length >= 6 + entries * 16);
    dimensions = Array.from({ length: entries }, (_, index) => [bytes[6 + index * 16] || 256, bytes[7 + index * 16] || 256]);
    assert(dimensions.some(([width, height]) => width === height && width >= 48 && width % 48 === 0), "Search-compatible ICO size");
  }
  results.push({ asset: new URL(url).pathname + new URL(url).search, status: response.status, mime, dimensions });
}
for (const path of ["/admin/subjects", "/admin/exam-tracks", "/admin/subjects/release-readonly-check/lessons", "/student", "/teacher", "/account/settings"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert([302, 303, 307, 308].includes(response.status), "Server-side anonymous guard: " + path);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/login");
  results.push({ path, status: response.status, anonymousRedirect: "/login" });
}
console.log(JSON.stringify({ passed: true, base: base.origin, readOnly: true, results }, null, 2));
