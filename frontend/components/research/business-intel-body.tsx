"use client";

import { Badge } from "@/components/ui/badge";
import { WebsiteDigestSection } from "@/components/scraper/website-digest-section";
import type { BusinessResearchModel } from "@/lib/business-research-model";
import type { SearchItemBusinessProfile } from "@/lib/scraper";

function humanizeAttrKey(key: string): string {
  if (key === "address") return "Address";
  if (key === "authority") return "Website";
  if (key === "oh") return "Hours";
  if (key.startsWith("phone:")) return "Phone";
  if (key.includes("accessibility")) return "Accessibility";
  if (key.includes("service")) return "Services";
  return key.replace(/[:_]/g, " ").replace(/\s+/g, " ").trim() || key;
}

export function BusinessIntelBody({
  model,
  profileCollectedAt,
}: {
  model: BusinessResearchModel;
  profileCollectedAt?: string | null;
}) {
  const profile = model.profile as SearchItemBusinessProfile | null;
  const mapsIntel = profile?.maps?.mapsIntel;
  const attrEntries = mapsIntel?.attributeMap ? Object.entries(mapsIntel.attributeMap) : [];
  const address =
    profile?.maps?.addressLine ||
    mapsIntel?.attributeMap?.address?.replace(/^Address:\s*/i, "").trim() ||
    null;
  const ctx = profile?.searchContext;
  const web = profile?.website;
  const digestAi = profile?.aiStructured ?? web?.aiStructured ?? null;
  const crawl = web?.crawl;
  const crawlSocial = (() => {
    const s = new Set<string>();
    crawl?.snapshots?.forEach((snap) => snap.socialLinks?.forEach((l) => s.add(l)));
    return [...s];
  })();

  const hasScraperIntel =
    profile &&
    (profile.maps ||
      profile.website ||
      profile.searchContext ||
      (model.rating != null && model.reviewCount != null));

  return (
    <div className="space-y-6 text-sm">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signal</h3>
          <dl className="mt-2 space-y-1.5">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Rating</dt>
              <dd className="font-medium">
                {model.rating != null ? `${model.rating}★` : "—"}
                {model.reviewCount != null ? (
                  <span className="ml-1 font-normal text-muted-foreground">({model.reviewCount} reviews)</span>
                ) : null}
              </dd>
            </div>
            {model.leadPromoted ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Lead</dt>
                <dd>
                  <Badge variant="success">{model.leadPromoted.status}</Badge>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Office & markets</h3>
          <dl className="mt-2 space-y-1.5">
            {address ? (
              <div>
                <dt className="text-muted-foreground">Address (Maps)</dt>
                <dd className="mt-0.5 font-medium leading-snug">{address}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Location / context</dt>
              <dd className="mt-0.5 text-foreground/90">
                {[model.category, [model.city, model.country].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            {ctx?.searchQuery ? (
              <div>
                <dt className="text-muted-foreground">Maps query</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">{ctx.searchQuery}</dd>
              </div>
            ) : null}
            {ctx?.businessType ? (
              <div>
                <dt className="text-muted-foreground">Search business type</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">{ctx.businessType}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {mapsIntel?.secondaryCategories?.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories & positioning</h3>
          <div className="flex flex-wrap gap-1.5">
            {model.category ? (
              <Badge variant="outline" className="font-normal">
                {model.category}
              </Badge>
            ) : null}
            {mapsIntel.secondaryCategories.map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {c}
              </Badge>
            ))}
          </div>
        </section>
      ) : model.category ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary category</h3>
          <Badge variant="outline">{model.category}</Badge>
        </section>
      ) : null}

      {mapsIntel?.hoursSummary ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours & availability</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-background px-3 py-2 text-xs leading-relaxed text-foreground/90">
            {mapsIntel.hoursSummary}
          </p>
        </section>
      ) : null}

      {attrEntries.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Google Maps details</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Attributes from the Maps place panel (accessibility, services, plus codes, etc.).
          </p>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60">
            <table className="w-full text-xs">
              <tbody>
                {attrEntries.map(([k, v]) => (
                  <tr key={k} className="border-b border-border/40 last:border-0">
                    <td className="w-[32%] px-2 py-1.5 align-top font-mono text-[10px] text-muted-foreground">{humanizeAttrKey(k)}</td>
                    <td className="px-2 py-1.5 align-top text-foreground/90">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-0.5 break-all font-medium">{model.emails.length ? model.emails.join(", ") : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="mt-0.5 font-medium">{model.phone || model.phones[0] || "—"}</p>
            {model.phones.length > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">{model.phones.slice(1).join(" · ")}</p>
            ) : null}
          </div>
        </div>
        {model.websiteUrl ? (
          <p className="mt-2">
            <a className="text-primary underline-offset-4 hover:underline" href={model.websiteUrl} target="_blank" rel="noreferrer">
              Open website
            </a>
          </p>
        ) : null}
      </section>

      {model.enrichment && Object.keys(model.enrichment).length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead enrichment (providers)</h3>
          <pre className="max-h-40 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] leading-relaxed">
            {JSON.stringify(model.enrichment, null, 2)}
          </pre>
        </section>
      ) : null}

      {!hasScraperIntel && !web?.extractedText ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
          No scraper dossier linked to this lead yet. When a contact is promoted from a Maps job, full research appears here automatically.
        </p>
      ) : null}

      {crawl && crawl.mode === "deep" ? (
        <section className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site crawl (same-origin)</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sitemap seeds, internal links, schema.org, meta tags, and social profiles.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Pages fetched</dt>
              <dd className="font-medium">{crawl.pagesCrawled ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Max depth / cap</dt>
              <dd className="font-medium">
                {crawl.maxDepth ?? "—"} hops · up to {crawl.maxPages ?? "—"} URLs
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sitemap URLs seeded</dt>
              <dd className="font-medium">{crawl.sitemapUrlsSeeded ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Text extracted</dt>
              <dd className="font-medium">{crawl.textCharsTotal != null ? `${crawl.textCharsTotal.toLocaleString()} chars` : "—"}</dd>
            </div>
          </dl>

          {crawlSocial.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Social & profiles</p>
              <ul className="mt-1.5 space-y-1">
                {crawlSocial.map((l) => (
                  <li key={l}>
                    <a className="break-all text-xs text-primary underline-offset-4 hover:underline" href={l} target="_blank" rel="noreferrer">
                      {l.replace(/^https?:\/\//, "").slice(0, 72)}
                      {l.length > 72 ? "…" : ""}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {crawl.snapshots?.some((s) => (s.jsonLdEntities?.length ?? 0) > 0) ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Structured data (schema.org)</p>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/80 p-2">
                {crawl.snapshots.flatMap((snap) =>
                  (snap.jsonLdEntities || []).map((ent, i) => (
                    <div key={`${snap.url}-${i}`} className="border-b border-border/30 pb-2 text-xs last:border-0 last:pb-0">
                      <p className="font-semibold text-foreground">{ent.name || ent.type}</p>
                      <p className="text-[10px] text-muted-foreground">{ent.type}</p>
                      {ent.description ? (
                        <p className="mt-1 leading-relaxed text-foreground/85">
                          {ent.description.slice(0, 600)}
                          {ent.description.length > 600 ? "…" : ""}
                        </p>
                      ) : null}
                      {ent.telephone ? <p className="mt-1 text-muted-foreground">Tel: {ent.telephone}</p> : null}
                      {ent.url ? (
                        <a className="mt-1 inline-block text-primary underline-offset-2 hover:underline" href={ent.url} target="_blank" rel="noreferrer">
                          {ent.url}
                        </a>
                      ) : null}
                    </div>
                  )),
                )}
              </div>
            </div>
          ) : null}

          {crawl.snapshots && crawl.snapshots.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Page intelligence</p>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-background/80 p-2">
                {crawl.snapshots.map((snap) => (
                  <div key={snap.url} className="border-b border-border/30 pb-2 text-xs last:border-0">
                    <p className="break-all font-mono text-[10px] text-muted-foreground">{snap.url}</p>
                    {snap.title ? <p className="mt-0.5 font-medium text-foreground">{snap.title}</p> : null}
                    {snap.h1 && snap.h1 !== snap.title ? <p className="mt-0.5 text-foreground/90">{snap.h1}</p> : null}
                    {snap.metaDescription ? <p className="mt-1 leading-relaxed text-muted-foreground">{snap.metaDescription}</p> : null}
                    {snap.h2Sample && snap.h2Sample.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
                        {snap.h2Sample.slice(0, 5).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {digestAi || web?.extractedText ? (
        <WebsiteDigestSection
          extractedText={web?.extractedText}
          aiStructured={digestAi}
          subtitle={
            web?.pagesVisited?.length
              ? `${web.pagesVisited.length} URL(s) in crawl${crawl?.mode === "deep" ? " (sitemap + internal links)" : ""}`
              : undefined
          }
        />
      ) : null}

      {profileCollectedAt ? (
        <p className="text-[11px] text-muted-foreground">Maps research captured {new Date(profileCollectedAt).toLocaleString()}</p>
      ) : null}
    </div>
  );
}
