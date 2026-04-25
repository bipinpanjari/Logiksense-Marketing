"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScraperJobRow } from "@/lib/scraper";

const STORAGE_KEY = "logikmarket.scraperAiDigestFlight";

const FLIGHT_MAX_MS = 6 * 60_000;

function readStored(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(m: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(m).length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    }
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Tracks scraper jobs where the user queued an AI digest and the worker may still be running.
 * Persisted in sessionStorage so navigation between pages does not drop the wand spinner.
 */
export function useAiDigestFlight(jobs: ScraperJobRow[] | undefined | null) {
  const [flightStartByJob, setFlightStartByJob] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = readStored();
    if (Object.keys(stored).length === 0) return;
    setFlightStartByJob((prev) => ({ ...stored, ...prev }));
  }, []);

  const markFlight = useCallback((jobId: string) => {
    const ts = Date.now();
    setFlightStartByJob((m) => {
      const next = { ...m, [jobId]: ts };
      writeStored(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const list = jobs ?? [];
    setFlightStartByJob((m) => {
      const next = { ...m };
      const now = Date.now();
      for (const id of Object.keys(next)) {
        const j = list.find((x) => x.id === id);
        if (j) {
          const a = j.digest_items_ai ?? 0;
          const t = j.digest_items_total ?? 0;
          if (t > 0 && a >= t) {
            delete next[id];
            continue;
          }
        }
        if (now - next[id] > FLIGHT_MAX_MS) {
          delete next[id];
        }
      }
      writeStored(next);
      return next;
    });
  }, [jobs]);

  const isInFlight = useCallback(
    (jobId: string, job: ScraperJobRow) => {
      if (!(jobId in flightStartByJob)) return false;
      if (job.status !== "completed") return false;
      const t = job.digest_items_total ?? 0;
      const a = job.digest_items_ai ?? 0;
      return t > 0 && a < t;
    },
    [flightStartByJob],
  );

  const anyInFlight = useMemo(() => Object.keys(flightStartByJob).length > 0, [flightStartByJob]);

  return { markFlight, isInFlight, anyInFlight };
}
