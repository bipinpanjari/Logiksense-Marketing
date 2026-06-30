import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadService, CreateLeadDto, UpdateLeadDto, PaginationParams } from './lead.service';
import { LeadImportService } from './lead-import.service';
import { LeadScoringService } from './lead-scoring.service';
import { ContactSegmentationService, SegmentCriteria } from './contact-segmentation.service';
import { EmailAnalyticsService } from './email-analytics.service';

import { FieldManagementService } from './field-management.service';


@Controller('api/leads')
export class LeadController {
  constructor(
    private leadService: LeadService,
    private leadImportService: LeadImportService,
    private leadScoringService: LeadScoringService,
    private segmentationService: ContactSegmentationService,

    private emailAnalyticsService: EmailAnalyticsService,
    private fieldManagementService: FieldManagementService

  ) {}

  private requireAuth(req: any) {
    if (!req?.user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return req.user;
  }

  // ===== LEAD CRUD =====

  @Post()
  async createLead(@Body() createLeadDto: CreateLeadDto, @Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadService.createLead(user.workspaceId, user.userId, createLeadDto);
  }

  @Get()
  async getLeads(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('company') company?: string,
    @Request() req?: any
  ) {
    const user = this.requireAuth(req);

    const params: PaginationParams = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      search,
      tags: tags ? tags.split(',') : undefined,
      company,
    };

    return this.leadService.getLeads(user.workspaceId, params);
  }

  @Get('stats')
  async getLeadStats(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadService.getLeadStats(user.workspaceId);
  }

  // ===== BULK OPERATIONS =====

  @Post('bulk/delete')
  async bulkDeleteLeads(@Body('leadIds') leadIds: string[], @Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadService.bulkDeleteLeads(user.workspaceId, leadIds);
  }

  @Put('bulk/update')
  async bulkUpdateLeads(
    @Body() body: { leadIds: string[]; updates: UpdateLeadDto },
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    return this.leadService.bulkUpdateLeads(
      user.workspaceId,
      body.leadIds,
      body.updates
    );
  }

  // ===== IMPORT =====

  @Post('import/file')
  @UseInterceptors(FileInterceptor('file'))
  async importLeads(
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type: 'csv' | 'excel' = 'csv',
    @Request() req: any
  ) {
    const user = this.requireAuth(req);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const fileType = file.originalname.toLowerCase();
    const isCSV = fileType.endsWith('.csv');
    const isExcel = fileType.endsWith('.xlsx') || fileType.endsWith('.xls');

    if (!isCSV && !isExcel) {
      throw new BadRequestException('Only CSV and Excel files are supported');
    }

    if (isCSV) {
      return this.leadImportService.importFromCSV(
        file.buffer,
        user.workspaceId,
        user.userId
      );
    } else {
      return this.leadImportService.importFromExcel(
        file.buffer,
        user.workspaceId,
        user.userId
      );
    }
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewImportLeads(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    this.requireAuth(req);
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.leadImportService.previewImport(file.buffer);
  }

  @Post('import/confirm')
  @UseInterceptors(FileInterceptor('file'))
  async confirmImportLeads(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingRaw: string,
    @Body('dedupeStrategy') dedupeStrategyRaw: 'skip' | 'update' | undefined,
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    let mapping: any = {};
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch {
        throw new BadRequestException('Invalid mapping payload');
      }
    }

    const dedupeStrategy = dedupeStrategyRaw === 'update' ? 'update' : 'skip';
    return this.leadImportService.confirmImport(
      file.buffer,
      user.workspaceId,
      user.userId,
      mapping,
      dedupeStrategy
    );
  }

  @Get('import/history')
  async getImportHistory(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadImportService.getImportHistory(user.workspaceId);
  }


  // ===== FIELD MANAGEMENT =====

  @Get(':id/fields')
  async getLeadFields(@Param('id') leadId: string, @Request() req: any) {
    const user = this.requireAuth(req);
    return this.fieldManagementService.getLeadFieldsState(user.workspaceId, leadId);
  }

  @Post(':id/fields/add')
  async addFieldToLead(
    @Param('id') leadId: string,
    @Body() body: { fieldName: string; fieldValue: any },
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    await this.fieldManagementService.addField(user.workspaceId, leadId, body.fieldName, body.fieldValue);
    return { success: true, message: 'Field added successfully' };
  }

  @Put(':id/fields/:fieldName')
  async updateFieldInLead(
    @Param('id') leadId: string,
    @Param('fieldName') fieldName: string,
    @Body() body: { fieldValue: any },
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    await this.fieldManagementService.updateField(user.workspaceId, leadId, fieldName, body.fieldValue);
    return { success: true, message: 'Field updated successfully' };
  }

  @Delete(':id/fields/:fieldName')
  async removeFieldFromLead(
    @Param('id') leadId: string,
    @Param('fieldName') fieldName: string,
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    await this.fieldManagementService.removeField(user.workspaceId, leadId, fieldName);
    return { success: true, message: 'Field removed successfully' };
  }

  @Get('fields/available')
  async getAvailableFields(@Request() req: any) {
    this.requireAuth(req);
    return this.fieldManagementService.getStandardFields();
  }


  // ===== LEAD SCORING =====

  private defaultScoringCriteria = {
    emailOpens: 5,
    emailClicks: 10,
    websiteVisits: 3,
    formSubmissions: 15,
    jobTitleWeight: 1,
    companySize: 1,
    engagementPeriod: 30,
  };

  @Get('score/:id')
  async getLeadScore(@Param('id') leadId: string, @Request() req: any) {
    this.requireAuth(req);
    return this.leadScoringService.calculateLeadScore(leadId, this.defaultScoringCriteria);
  }

  @Post('score/batch')
  async batchScoreLeads(@Body() body: { leadIds?: string[] }, @Request() req: any) {
    const user = this.requireAuth(req);
    if (body.leadIds && body.leadIds.length > 0) {
      // Score specific leads
      const results = [];
      for (const leadId of body.leadIds) {
        const score = await this.leadScoringService.calculateLeadScore(
          leadId,
          this.defaultScoringCriteria
        );
        results.push(score);
      }
      return results;
    } else {
      // Score all leads in workspace
      return this.leadScoringService.scoreAllLeads(user.workspaceId);
    }
  }

  @Get('score/threshold/:minScore')
  async getLeadsByScore(
    @Param('minScore') minScore: string,
    @Query('maxScore') maxScore?: string,
    @Request() req?: any
  ) {
    const user = this.requireAuth(req);
    const min = parseInt(minScore);
    const max = maxScore ? parseInt(maxScore) : 100;
    return this.leadScoringService.getLeadsByScoreThreshold(user.workspaceId, min, max);
  }

  // ===== SEGMENTATION =====

  @Post('segments')
  async createSegment(
    @Body() body: {
      name: string;
      description: string;
      criteria: SegmentCriteria;
    },
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    return this.segmentationService.createSegment(
      user.workspaceId,
      body.name,
      body.description,
      body.criteria
    );
  }

  @Get('segments')
  async getSegments(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.segmentationService.getSegments(user.workspaceId);
  }

  @Get('segments/:segmentId')
  async getSegmentDetails(@Param('segmentId') segmentId: string, @Request() req: any) {
    this.requireAuth(req);
    return this.segmentationService.getSegmentDetails(segmentId);
  }

  @Get('segments/:segmentId/members')
  async getSegmentMembers(
    @Param('segmentId') segmentId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Request() req?: any
  ) {
    this.requireAuth(req);
    return this.segmentationService.getSegmentMembers(
      segmentId,
      offset ? parseInt(offset) : 0,
      limit ? parseInt(limit) : 50
    );
  }

  @Put('segments/:segmentId')
  async updateSegmentCriteria(
    @Param('segmentId') segmentId: string,
    @Body('criteria') criteria: SegmentCriteria,
    @Request() req: any
  ) {
    this.requireAuth(req);
    return this.segmentationService.updateSegmentCriteria(segmentId, criteria);
  }

  @Post('segments/:segmentId/refresh')
  async refreshSegmentMembers(@Param('segmentId') segmentId: string, @Request() req: any) {
    this.requireAuth(req);
    const memberCount = await this.segmentationService.refreshSegmentMembers(segmentId);
    return { segmentId, memberCount, message: 'Segment refreshed' };
  }

  @Delete('segments/:segmentId')
  async deleteSegment(@Param('segmentId') segmentId: string, @Request() req: any) {
    this.requireAuth(req);
    await this.segmentationService.deleteSegment(segmentId);
    return { message: 'Segment deleted' };
  }

  @Get('segments/built-in/high-value')
  async getHighValueLeads(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.segmentationService.getHighValueSegment(user.workspaceId);
  }

  @Get('segments/built-in/at-risk')
  async getAtRiskLeads(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.segmentationService.getAtRiskSegment(user.workspaceId);
  }

  // ===== EMAIL ANALYTICS (workspace/campaign level) =====
  // Lead-level email analytics lives with the other :id routes at the bottom.

  @Get('analytics/campaigns/top')
  async getTopCampaigns(@Query('limit') limit?: string, @Request() req?: any) {
    const user = this.requireAuth(req);
    return this.emailAnalyticsService.getTopCampaigns(
      user.workspaceId,
      limit ? parseInt(limit) : 10
    );
  }

  @Get('analytics/campaigns/:campaignId')
  async getCampaignAnalytics(@Param('campaignId') campaignId: string, @Request() req: any) {
    this.requireAuth(req);
    return this.emailAnalyticsService.getCampaignAnalytics(campaignId);
  }

  @Get('analytics/workspace/summary')
  async getWorkspaceAnalyticsSummary(@Request() req: any) {
    const user = this.requireAuth(req);
    return this.emailAnalyticsService.getWorkspaceAnalyticsSummary(user.workspaceId);
  }

  @Get('analytics/most-engaged')
  async getMostEngagedLeads(@Query('limit') limit?: string, @Request() req?: any) {
    const user = this.requireAuth(req);
    return this.emailAnalyticsService.getMostEngagedLeads(
      user.workspaceId,
      limit ? parseInt(limit) : 20
    );
  }

  // ===== PARAMETRIC LEAD-BY-ID ROUTES =====
  // IMPORTANT: These must remain at the bottom so static routes like
  // /api/leads/segments, /api/leads/stats, /api/leads/analytics/*,
  // and /api/leads/score/* are not shadowed by :id.

  @Get(':id/email-analytics')
  async getLeadEmailAnalytics(@Param('id') leadId: string, @Request() req: any) {
    this.requireAuth(req);
    return this.emailAnalyticsService.getLeadAnalytics(leadId);
  }

  @Get(':id/engagement-timeline')
  async getEngagementTimeline(@Param('id') leadId: string, @Request() req: any) {
    this.requireAuth(req);
    return this.emailAnalyticsService.getLeadEngagementTimeline(leadId);
  }

  @Get(':id')
  async getLead(@Param('id') leadId: string, @Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadService.getLead(user.workspaceId, leadId);
  }

  @Put(':id')
  async updateLead(
    @Param('id') leadId: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @Request() req: any
  ) {
    const user = this.requireAuth(req);
    return this.leadService.updateLead(user.workspaceId, leadId, updateLeadDto);
  }

  @Delete(':id')
  async deleteLead(@Param('id') leadId: string, @Request() req: any) {
    const user = this.requireAuth(req);
    return this.leadService.deleteLead(user.workspaceId, leadId);
  }
}
