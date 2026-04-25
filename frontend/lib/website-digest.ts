/**
 * Parses the concatenated digest produced by the scraper (see WebsiteScraperService.composeSegmentText).
 * Format per block: \n---\n{url}\n---\n{body}
 */
export interface WebsiteDigestChunk {
  url: string;
  body: string;
  /** Heuristic: common CMS 404 patterns in extracted body text */
  looksLikeNotFound: boolean;
}

export function parseWebsiteDigest(extractedText: string | null | undefined): WebsiteDigestChunk[] {
  if (!extractedText?.trim()) return [];
  const parts = extractedText.split(/\n---\n/);
  const out: WebsiteDigestChunk[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const url = (parts[i] || "").trim();
    const body = (parts[i + 1] || "").trim();
    if (!url.startsWith("http")) continue;
    out.push({
      url,
      body,
      looksLikeNotFound: detectNotFoundPage(body),
    });
  }
  return out;
}

function detectNotFoundPage(body: string): boolean {
  const b = body.toLowerCase();
  if (/\b404\b/.test(b) && (/page not found|not found|oops/i.test(b) || /can\x27t find/i.test(b))) return true;
  if (/page not found/i.test(b) && /search/i.test(b)) return true;
  if (/can't find what/i.test(b) || /cannot find/i.test(b)) return true;
  return false;
}

export function shortUrlLabel(url: string): string {
  if (url === "maps:listing") return "Google Maps listing";
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") || "/") + (u.search ? u.search : "");
  } catch {
    return url.slice(0, 80);
  }
}
