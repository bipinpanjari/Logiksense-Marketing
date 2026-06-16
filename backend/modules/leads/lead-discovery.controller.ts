import { Controller, Get, Query, UseGuards, Req, Post, Body, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { ApolloService, ApolloSearchParams } from '../ai/apollo.service';
import { LeadService } from './lead.service';

@Controller('lead-discovery')
@UseGuards(JwtAuthGuard)
export class LeadDiscoveryController {
  constructor(
    private readonly apollo: ApolloService,
    private readonly leadService: LeadService,
  ) {}

  @Get('search')
  async search(@Req() req: any, @Query() query: any) {
    const workspaceId = req.user.workspaceId;
    const params: ApolloSearchParams = {
      domains: query.domains ? query.domains.split(',') : undefined,
      titles: query.titles ? query.titles.split(',') : undefined,
      qKeywords: query.q,
      page: query.page ? parseInt(query.page) : 1,
    };

    const result = await this.apollo.searchPeople(workspaceId, params);
    if (!result) {
        throw new BadRequestException('Apollo search failed or not configured for this workspace.');
    }
    return result;
  }

  @Post('import')
  async import(@Req() req: any, @Body() body: { personId: string }) {
    const workspaceId = req.user.workspaceId;
    const customerId = req.user.id;

    // 1. Enrich/Reveal the person (Costs 1 credit)
    const person = await this.apollo.enrichPerson(workspaceId, body.personId);
    if (!person || !person.email) {
        throw new BadRequestException('Failed to retrieve verified email for this contact.');
    }

    // 2. Create lead in the CRM
    const lead = await this.leadService.createLead(workspaceId, customerId, {
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        company: person.organizationName,
        phone: person.phone,
        tags: ['apollo-discovery'],
        customFields: {
            apolloId: person.id,
            linkedinUrl: person.linkedinUrl,
            title: person.title,
        }
    });

    return { success: true, leadId: lead.id };
  }
}
