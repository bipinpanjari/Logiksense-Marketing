import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface RenderContext {
  lead: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    company?: string | null;
    jobTitle?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    customFields?: Record<string, any> | null;
  };
  workspace: {
    id: string;
    name?: string | null;
  };
  sender: {
    email: string;
    name?: string | null;
  };
  urls: {
    openPixel: string;
    unsubscribe: string;
    clickWrap: (targetUrl: string) => string;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Handlebars-lite renderer that supports:
 *   - {{firstName}}, {{lastName}}, {{email}}, {{company}}, {{jobTitle}},
 *     {{fullName}}, {{city}}, {{state}}, {{country}}
 *   - {{custom.<key>}}
 *   - {{sender.email}}, {{sender.name}}, {{workspace.name}}
 *   - {{unsubscribe_url}}
 *   - {{#if firstName}}Hi {{firstName}}{{else}}Hi there{{/if}}  (single-level)
 */
@Injectable()
export class TemplateRendererService {
  render(templateHtml: string, subject: string, bodyText: string | null, ctx: RenderContext): RenderedEmail {
    const renderedSubject = this.applyVars(subject ?? '', ctx);
    const renderedTextRaw = this.applyVars(bodyText ?? this.htmlToText(templateHtml), ctx);
    const renderedHtmlRaw = this.applyVars(templateHtml ?? '', ctx);

    const htmlWithClicks = this.rewriteLinks(renderedHtmlRaw, ctx);
    const htmlWithPixel = this.injectPixel(htmlWithClicks, ctx.urls.openPixel);
    const htmlWithFooter = this.injectUnsubscribeFooter(htmlWithPixel, ctx.urls.unsubscribe);

    const textWithFooter = `${renderedTextRaw.trim()}\n\n-- \nUnsubscribe: ${ctx.urls.unsubscribe}`;

    return {
      subject: renderedSubject.trim() || '(no subject)',
      html: htmlWithFooter,
      text: textWithFooter,
    };
  }

  private applyVars(input: string, ctx: RenderContext): string {
    if (!input) return '';
    const fullName = [ctx.lead.firstName, ctx.lead.lastName].filter(Boolean).join(' ').trim();
    const scalarMap: Record<string, string> = {
      firstName: ctx.lead.firstName ?? '',
      lastName: ctx.lead.lastName ?? '',
      fullName: fullName || (ctx.lead.firstName ?? ''),
      email: ctx.lead.email ?? '',
      company: ctx.lead.company ?? '',
      jobTitle: ctx.lead.jobTitle ?? '',
      city: ctx.lead.city ?? '',
      state: ctx.lead.state ?? '',
      country: ctx.lead.country ?? '',
      'sender.email': ctx.sender.email,
      'sender.name': ctx.sender.name ?? '',
      'workspace.name': ctx.workspace.name ?? '',
      unsubscribe_url: ctx.urls.unsubscribe,
    };

    // Resolve single-level {{#if var}}A{{else}}B{{/if}}
    let out = input.replace(
      /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
      (_m, key, ifBlock, elseBlock) => {
        const val = this.resolve(key, scalarMap, ctx);
        return val && val.trim() ? ifBlock : elseBlock ?? '';
      },
    );

    // Resolve simple {{var}} and {{custom.key}}
    out = out.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key) => {
      return this.escape(this.resolve(key, scalarMap, ctx));
    });
    return out;
  }

  private resolve(key: string, scalarMap: Record<string, string>, ctx: RenderContext): string {
    if (scalarMap[key] !== undefined) return scalarMap[key];
    if (key.startsWith('custom.')) {
      const k = key.slice('custom.'.length);
      const v = ctx.lead.customFields?.[k];
      return v == null ? '' : String(v);
    }
    return '';
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private injectPixel(html: string, pixelUrl: string): string {
    const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="border:0;display:block;"/>`;
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return `${html}${pixel}`;
  }

  private injectUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
    const footer = `
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:12px;color:#666;">
        Don't want these emails? <a href="${unsubscribeUrl}" style="color:#666;">Unsubscribe</a>.
      </div>`;
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${footer}</body>`);
    }
    return `${html}${footer}`;
  }

  private rewriteLinks(html: string, ctx: RenderContext): string {
    return html.replace(
      /<a\s+([^>]*?)href=(["'])(https?:[^"']+)\2([^>]*)>/gi,
      (_m, pre: string, quote: string, url: string, post: string) => {
        if (url.startsWith(ctx.urls.unsubscribe)) return _m;
        const wrapped = ctx.urls.clickWrap(url);
        return `<a ${pre}href=${quote}${wrapped}${quote}${post}>`;
      },
    );
  }

  private htmlToText(html: string): string {
    return (html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Creates a short tracking token stable for (logId).
   */
  newTrackingToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}
