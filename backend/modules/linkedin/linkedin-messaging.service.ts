import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import { getDatabase } from '../../shared/database';
import { randomDelay } from './linkedin-browser';

export interface DMSequenceStep {
  step: number;
  dayOffset: number;
  message: string;
  tag: string;
}

export const DEFAULT_DM_SEQUENCE: DMSequenceStep[] = [
  {
    step: 1,
    dayOffset: 1,
    message:
      "Hey {first_name}, thanks for connecting! I noticed you're {job_title} at {company} - would love to hear what's keeping you busy right now.",
    tag: 'warm_welcome',
  },
  {
    step: 2,
    dayOffset: 3,
    message:
      "Hey {first_name}, short follow-up. I put together a quick breakdown of how {industry} teams are saving hours with AI-assisted outreach - happy to share if useful.",
    tag: 'value_drop',
  },
  {
    step: 3,
    dayOffset: 7,
    message:
      "Hey {first_name}, last follow-up - don't want to crowd your inbox. If a 15-min chat about {industry} + {company} sounds useful, I'll work around your schedule.",
    tag: 'soft_ask',
  },
];

/**
 * Messaging service - sends DMs via LinkedIn threads. Thread ID is captured
 * the first time the conversation is opened, then reused so we don't navigate
 * to stale URLs that no longer resolve (fixes the thread-id bug noted in the
 * migration plan).
 */
@Injectable()
export class LinkedInMessagingService {
  private readonly logger = new Logger(LinkedInMessagingService.name);

  renderTemplate(template: string, vars: Record<string, string | undefined>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => (vars[key] ?? '').trim() || key.replace(/_/g, ' '));
  }

  async openOrResumeThread(page: Page, profileUrl: string, threadId?: string | null): Promise<string | null> {
    try {
      if (threadId) {
        const threadUrl = `https://www.linkedin.com/messaging/thread/${threadId}/`;
        await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(1000, 2500);
        if (page.url().includes('/messaging/thread/')) {
          return threadId;
        }
      }

      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(1500, 3000);

      const messageBtn = await page.$(
        'button[aria-label*="Message" i], a[aria-label*="Message" i], button:has-text("Message")',
      );
      if (!messageBtn) return null;
      await messageBtn.click();
      await randomDelay(1500, 3500);

      // LinkedIn sometimes opens an overlay; capture thread id from URL if it updates.
      const url = page.url();
      const match = url.match(/\/messaging\/thread\/([^\/?#]+)/);
      return match ? match[1] : null;
    } catch (err) {
      this.logger.warn(`openOrResumeThread failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async sendMessage(page: Page, body: string): Promise<boolean> {
    try {
      const editorSelectors = [
        'div.msg-form__contenteditable[contenteditable="true"]',
        'textarea[data-test-id="compose-area"]',
        'div[role="textbox"][contenteditable="true"]',
      ];
      let editor: any = null;
      for (const sel of editorSelectors) {
        editor = await page.$(sel);
        if (editor) break;
      }
      if (!editor) {
        this.logger.warn('message editor not found');
        return false;
      }
      await editor.click();
      await randomDelay(300, 600);
      // Type with natural cadence
      for (const ch of body) {
        await page.keyboard.type(ch, { delay: 20 + Math.random() * 40 });
      }
      await randomDelay(400, 900);

      const sendBtnSelectors = [
        'button.msg-form__send-button',
        'button[data-test-id="send-message"]',
        'button[type="submit"]:has-text("Send")',
      ];
      let sendBtn: any = null;
      for (const sel of sendBtnSelectors) {
        sendBtn = await page.$(sel);
        if (sendBtn) break;
      }
      if (!sendBtn) {
        this.logger.warn('send button not found');
        return false;
      }
      await sendBtn.click();
      await randomDelay(1500, 3500);
      return true;
    } catch (err) {
      this.logger.warn(`sendMessage failed: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  async checkForReply(
    page: Page,
  ): Promise<{ hasReply: boolean; text?: string; classification?: string }> {
    try {
      const replyText: string = await page.evaluate(() => {
        const bubbles = Array.from(document.querySelectorAll('.msg-s-event-listitem, [data-test-id="message-bubble"]'));
        if (bubbles.length === 0) return '';
        const last = bubbles[bubbles.length - 1];
        // Heuristic: if the bubble has "msg-s-event-listitem--other" or no "sent-by-me", treat as inbound.
        const isOutbound = last.classList.contains('msg-s-event-listitem--sent-by-me') || last.classList.contains('sent-by-me');
        if (isOutbound) return '';
        return (last.textContent || '').trim();
      });
      if (!replyText) return { hasReply: false };
      return { hasReply: true, text: replyText, classification: classifyReply(replyText) };
    } catch {
      return { hasReply: false };
    }
  }

  async persistReply(sequenceId: string, text: string, classification: string) {
    const db = getDatabase();
    await db.query(
      `UPDATE linkedin_sequences
       SET status = 'replied', reply_text = $1, reply_classification = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3::uuid`,
      [text, classification, sequenceId],
    );
  }
}

export function classifyReply(text: string): string {
  const lower = text.toLowerCase();
  if (/(interested|tell me more|let'?s chat|yes|absolutely|sounds good|keen|love to)/i.test(lower)) return 'positive';
  if (/(not interested|remove|stop|unsubscribe|spam|delete|not relevant|busy)/i.test(lower)) return 'negative';
  if (/(away|vacation|out of office|ooo|on leave|back on)/i.test(lower)) return 'ooo';
  return 'neutral';
}
