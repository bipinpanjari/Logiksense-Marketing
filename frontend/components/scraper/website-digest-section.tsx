"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseWebsiteDigest, shortUrlLabel, type WebsiteDigestChunk } from "@/lib/website-digest";
import type { WebsiteDigestStructured } from "@/lib/scraper";

export function WebsiteDigestSection({
  extractedText,
  subtitle,
  aiStructured,
}: {
  extractedText: string | null | undefined;
  subtitle?: string;
  aiStructured?: WebsiteDigestStructured | null;
}) {
  const chunks = parseWebsiteDigest(extractedText || "");
  const hasRaw = Boolean(extractedText?.trim());
  if (chunks.length === 0 && !hasRaw && !aiStructured) return null;

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Scraper research (Maps, contacts &amp; site crawl)
      </h3>
      {subtitle ? <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p> : null}

      {aiStructured ? (
        <div className="mb-5 space-y-5 rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              AI research brief (rep-style)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{aiStructured.siteOverview}</p>
            {aiStructured.structuredAt ? (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Generated {new Date(aiStructured.structuredAt).toLocaleString()}
                {aiStructured.model ? ` · ${aiStructured.model}` : ""}
              </p>
            ) : null}
          </div>

          {aiStructured.accountBrief ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Account narrative</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/88">{aiStructured.accountBrief}</p>
            </div>
          ) : null}

          {aiStructured.outreachAngles && aiStructured.outreachAngles.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outreach angles</p>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-foreground/88">
                {aiStructured.outreachAngles.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {aiStructured.openQuestions && aiStructured.openQuestions.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Verify / gaps</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
                {aiStructured.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {aiStructured.callPrepNotes ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Call prep</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/88">{aiStructured.callPrepNotes}</p>
            </div>
          ) : null}

          {aiStructured.pages.length > 0 ? (
            <details className="rounded-md border border-border/50 bg-background/50">
              <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Supporting notes by source ({aiStructured.pages.length})
              </summary>
              <ul className="space-y-3 border-t border-border/40 px-3 py-3">
                {aiStructured.pages.map((p, idx) => (
                  <li key={`${p.url}-${idx}`} className="rounded-md border border-border/60 bg-background/80 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-[10px] text-muted-foreground">{shortUrlLabel(p.url)}</span>
                      {p.pageKind && p.pageKind !== "other" ? (
                        <Badge variant="outline" className="h-5 text-[10px] font-normal capitalize">
                          {p.pageKind.replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                      {p.likelyNotFound ? (
                        <Badge variant="outline" className="h-5 text-[10px] font-normal text-caution-fg">
                          Likely 404 / thin
                        </Badge>
                      ) : null}
                    </div>
                    {p.title ? <p className="mt-1 text-xs font-medium text-foreground">{p.title}</p> : null}
                    <p className="mt-1.5 text-xs leading-relaxed text-foreground/88">{p.summary}</p>
                    {p.keyPoints.length > 0 ? (
                      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                        {p.keyPoints.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    ) : null}
                    {p.url.startsWith("http") ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-[10px] text-primary underline-offset-2 hover:underline"
                      >
                        Open in browser
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {hasRaw || chunks.length > 0 ? (
        <>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Raw site crawl text {aiStructured ? "(verbatim)" : ""}
          </h4>
          {!aiStructured ? (
            <p className="mb-2 text-xs text-muted-foreground">
              Enable <span className="font-medium text-foreground/80">AI personalization</span> on the workspace, then use{" "}
              <span className="font-medium text-foreground/80">Run AI personalization</span> on the job or re-run a crawl.
            </p>
          ) : null}
          {chunks.length === 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {extractedText}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {chunks.length} page{chunks.length === 1 ? "" : "s"} in this digest — expand any row to read the extracted text for that URL.
              </p>
              <ul className="space-y-2">
                {chunks.map((chunk) => (
                  <DigestChunkRow key={chunk.url} chunk={chunk} />
                ))}
              </ul>
            </div>
          )}
        </>
      ) : !aiStructured ? (
        <p className="text-xs text-muted-foreground">
          Enable <span className="font-medium text-foreground/80">AI personalization</span> to summarize Maps and listing data when no website crawl is available.
        </p>
      ) : null}
    </section>
  );
}

function DigestChunkRow({ chunk }: { chunk: WebsiteDigestChunk }) {
  const [open, setOpen] = useState(!chunk.looksLikeNotFound);
  const label = shortUrlLabel(chunk.url);
  return (
    <li className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[11px] font-medium text-foreground">{label}</span>
            {chunk.looksLikeNotFound ? (
              <Badge variant="outline" className="h-5 text-[10px] font-normal text-caution-fg">
                Likely 404 / thin page
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-5 text-[10px] font-normal">
                {chunk.body.length.toLocaleString()} chars
              </Badge>
            )}
          </div>
          <a
            href={chunk.url}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block text-[10px] text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Open in browser
          </a>
        </div>
      </button>
      {open ? (
        <div className="border-t border-border/60 bg-muted/10 px-3 py-3">
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{chunk.body}</p>
        </div>
      ) : null}
    </li>
  );
}
