import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { VaultService } from '../../shared/vault.service';
import { AiUsageService } from './ai-usage.service';

export interface ApolloSearchPerson {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  linkedinUrl?: string;
  organizationName?: string;
  organizationDomain?: string;
  email?: string;
  phone?: string;
  headline?: string;
  photoUrl?: string;
}

export interface ApolloSearchParams {
  domains?: string[];
  titles?: string[];
  locations?: string[];
  qKeywords?: string;
  page?: number;
  perPage?: number;
}

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);
  private readonly BASE_URL = 'https://api.apollo.io/v1';

  constructor(
    private readonly vault: VaultService,
    private readonly usage: AiUsageService,
  ) {}

  private async getApiKey(workspaceId: string): Promise<string | null> {
    return await this.vault.get({
      scope: 'apollo',
      refKey: `workspace:${workspaceId}`,
      workspaceId,
    });
  }

  /**
   * Search for people using Apollo's mixed_people search.
   * This is "cautious" because searching alone doesn't always cost credits 
   * (fetching verified emails costs credits).
   */
  async searchPeople(workspaceId: string, params: ApolloSearchParams): Promise<{
    people: ApolloSearchPerson[];
    pagination: { total_entries: number; total_pages: number; current_page: number };
  } | null> {
    const apiKey = await this.getApiKey(workspaceId);
    if (!apiKey) return null;

    try {
      const response = await axios.post(
        `${this.BASE_URL}/mixed_people/search`,
        {
          api_key: apiKey,
          q_organization_domains: params.domains?.join('\n'),
          person_titles: params.titles,
          q_keywords: params.qKeywords,
          page: params.page || 1,
          per_page: Math.min(params.perPage || 10, 100),
        },
        { timeout: 30000 }
      );

      const data = response.data;
      const people: ApolloSearchPerson[] = (data.people || []).map((p: any) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        name: p.name,
        title: p.title,
        linkedinUrl: p.linkedin_url,
        organizationName: p.organization?.name,
        organizationDomain: p.organization?.primary_domain,
        email: p.email, // Might be null if not "revealed"
        headline: p.headline,
        photoUrl: p.photo_url,
      }));

      await this.usage.log({
        workspaceId,
        provider: 'apollo',
        model: 'mixed_people_search',
        operation: 'search',
        byok: true,
        status: 'ok',
      });

      return {
        people,
        pagination: data.pagination || { total_entries: 0, total_pages: 0, current_page: 1 },
      };
    } catch (err: any) {
      this.logger.error(`Apollo search failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Specifically "reveal" (enrich) a person to get their verified email/phone.
   * THIS COSTS CREDITS. Use sparingly.
   */
  async enrichPerson(workspaceId: string, personId: string): Promise<ApolloSearchPerson | null> {
    const apiKey = await this.getApiKey(workspaceId);
    if (!apiKey) return null;

    try {
      const response = await axios.post(
        `${this.BASE_URL}/people/match`,
        {
          api_key: apiKey,
          id: personId,
          reveal_personal_emails: true,
          reveal_phone_number: true,
        },
        { timeout: 20000 }
      );

      const p = response.data?.person;
      if (!p) return null;

      await this.usage.log({
        workspaceId,
        provider: 'apollo',
        model: 'people_match',
        operation: 'enrich',
        byok: true,
        status: 'ok',
      });

      return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        name: p.name,
        title: p.title,
        linkedinUrl: p.linkedin_url,
        organizationName: p.organization?.name,
        organizationDomain: p.organization?.primary_domain,
        email: p.email,
        phone: p.phone_numbers?.[0]?.sanitized_number,
        headline: p.headline,
        photoUrl: p.photo_url,
      };
    } catch (err: any) {
      this.logger.error(`Apollo enrich failed for ${personId}: ${err.message}`);
      return null;
    }
  }
}
