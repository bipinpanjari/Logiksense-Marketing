import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@(?!(?:example|test|domain|email|sentry|github|wixpress|wix|sentry-next)\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{3,4})?/g;

const BAD_EMAIL_LOCAL = ['example', 'noreply', 'no-reply', 'mailer-daemon', 'donotreply', 'postmaster'];

export interface ExtractedContact {
  emails: string[];
  phones: string[];
  texts: string[];
}

@Injectable()
export class EmailExtractorService {
  private readonly logger = new Logger(EmailExtractorService.name);

  /**
   * Extract emails + phones from raw HTML. Deduplicates, validates, and filters
   * obvious noise (example.com, noreply@, tracking IDs).
   */
  extractFromHtml(html: string): ExtractedContact {
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();
    const text = $('body').text() || $.root().text();

    const mailHrefs: string[] = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const addr = href.replace(/^mailto:/i, '').split('?')[0];
      if (addr) mailHrefs.push(addr);
    });

    const telHrefs: string[] = [];
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const num = href.replace(/^tel:/i, '');
      if (num) telHrefs.push(num);
    });

    const emailMatches: string[] = [
      ...((text.match(EMAIL_RE) || []) as string[]).map((x) => x.toLowerCase()),
      ...mailHrefs.map((x) => x.toLowerCase()),
    ];
    const phoneMatches: string[] = [
      ...((text.match(PHONE_RE) || []) as string[]),
      ...telHrefs,
    ];

    return {
      emails: this.dedupeEmails(emailMatches),
      phones: this.dedupePhones(phoneMatches),
      texts: this.summarizeText(text),
    };
  }

  private dedupeEmails(raw: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of raw) {
      const clean = (e || '').trim().toLowerCase();
      if (!clean || !/@/.test(clean)) continue;
      if (clean.length > 254) continue;
      const [local, domain] = clean.split('@');
      if (!local || !domain) continue;
      if (BAD_EMAIL_LOCAL.some((bad) => local.startsWith(bad))) continue;
      if (/\.(png|jpg|jpeg|svg|webp|gif)$/i.test(domain)) continue;
      if (/sentry|wixpress|tracking|pixel/i.test(domain)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
      if (out.length > 10) break;
    }
    return out;
  }

  private dedupePhones(raw: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of raw) {
      const digits = (p || '').replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);
      out.push(p.trim());
      if (out.length > 5) break;
    }
    return out;
  }

  private summarizeText(text: string): string[] {
    const collapsed = text.replace(/\s+/g, ' ').trim();
    if (!collapsed) return [];
    return collapsed.length > 4000 ? [collapsed.slice(0, 4000)] : [collapsed];
  }
}
