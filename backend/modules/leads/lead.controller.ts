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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadService, CreateLeadDto, UpdateLeadDto, PaginationParams } from './lead.service';
import { LeadImportService } from './lead-import.service';
import { LeadScoringService } from './lead-scoring.service';
import { ContactSegmentationService, SegmentCriteria } from './contact-segmentation.service';
import { EmailAnalyticsService } from './email-analytics.service';

@Controller('api/leads')
export class LeadController {
  constructor(
    private leadService: LeadService,
    private leadImportService: LeadImportService,
    private leadScoringService: LeadScoringService,
    private segmentationService: ContactSegmentationService,
    private emailAnalyticsService: EmailAnalyticsService
  ) {}

  // ===== LEAD CRUD =====

  @Post()
  async createLead(@Body() createLeadDto: CreateLeadDto, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.createLead(req.user.workspaceId, req.user.userId, createLeadDto);
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
    if (!req.user) {
      throw new Error('Unauthorized');
    }

    const params: PaginationParams = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      search,
      tags: tags ? tags.split(',') : undefined,
      company,
    };

    return this.leadService.getLeads(req.user.workspaceId, params);
  }

  @Get('stats')
  async getLeadStats(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.getLeadStats(req.user.workspaceId);
  }

  @Get(':id')
  async getLead(@Param('id') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.getLead(req.user.workspaceId, leadId);
  }

  @Put(':id')
  async updateLead(
    @Param('id') leadId: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @Request() req: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.updateLead(req.user.workspaceId, leadId, updateLeadDto);
  }

  @Delete(':id')
  async deleteLead(@Param('id') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.deleteLead(req.user.workspaceId, leadId);
  }

  // ===== BULK OPERATIONS =====

  @Post('bulk/delete')
  async bulkDeleteLeads(@Body('leadIds') leadIds: string[], @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.bulkDeleteLeads(req.user.workspaceId, leadIds);
  }

  @Put('bulk/update')
  async bulkUpdateLeads(
    @Body() body: { leadIds: string[]; updates: UpdateLeadDto },
    @Request() req: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadService.bulkUpdateLeads(
      req.user.workspaceId,
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
    if (!req.user) {
      throw new Error('Unauthorized');
    }

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
        req.user.workspaceId,
        req.user.userId
      );
    } else {
      return this.leadImportService.importFromExcel(
        file.buffer,
        req.user.workspaceId,
        req.user.userId
      );
    }
  }

  @Get('import/history')
  async getImportHistory(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadImportService.getImportHistory(req.user.workspaceId);
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
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.leadScoringService.calculateLeadScore(leadId, this.defaultScoringCriteria);
  }

  @Post('score/batch')
  async batchScoreLeads(@Body() body: { leadIds?: string[] }, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
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
      return this.leadScoringService.scoreAllLeads(req.user.workspaceId);
    }
  }

  @Get('score/threshold/:minScore')
  async getLeadsByScore(
    @Param('minScore') minScore: string,
    @Query('maxScore') maxScore?: string,
    @Request() req?: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    const min = parseInt(minScore);
    const max = maxScore ? parseInt(maxScore) : 100;
    return this.leadScoringService.getLeadsByScoreThreshold(req.user.workspaceId, min, max);
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
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.createSegment(
      req.user.workspaceId,
      body.name,
      body.description,
      body.criteria
    );
  }

  @Get('segments')
  async getSegments(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.getSegments(req.user.workspaceId);
  }

  @Get('segments/:segmentId')
  async getSegmentDetails(@Param('segmentId') segmentId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.getSegmentDetails(segmentId);
  }

  @Get('segments/:segmentId/members')
  async getSegmentMembers(
    @Param('segmentId') segmentId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Request() req?: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
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
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.updateSegmentCriteria(segmentId, criteria);
  }

  @Post('segments/:segmentId/refresh')
  async refreshSegmentMembers(@Param('segmentId') segmentId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    const memberCount = await this.segmentationService.refreshSegmentMembers(segmentId);
    return { segmentId, memberCount, message: 'Segment refreshed' };
  }

  @Delete('segments/:segmentId')
  async deleteSegment(@Param('segmentId') segmentId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    await this.segmentationService.deleteSegment(segmentId);
    return { message: 'Segment deleted' };
  }

  @Get('segments/built-in/high-value')
  async getHighValueLeads(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.getHighValueSegment(req.user.workspaceId);
  }

  @Get('segments/built-in/at-risk')
  async getAtRiskLeads(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.segmentationService.getAtRiskSegment(req.user.workspaceId);
  }

  // ===== EMAIL ANALYTICS =====

  @Get(':id/email-analytics')
  async getLeadEmailAnalytics(@Param('id') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getLeadAnalytics(leadId);
  }

  @Get('analytics/campaigns/:campaignId')
  async getCampaignAnalytics(@Param('campaignId') campaignId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getCampaignAnalytics(campaignId);
  }

  @Get('analytics/workspace/summary')
  async getWorkspaceAnalyticsSummary(@Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getWorkspaceAnalyticsSummary(req.user.workspaceId);
  }

  @Get('analytics/campaigns/top')
  async getTopCampaigns(@Query('limit') limit?: string, @Request() req?: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getTopCampaigns(
      req.user.workspaceId,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(':id/engagement-timeline')
  async getEngagementTimeline(@Param('id') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getLeadEngagementTimeline(leadId);
  }

  @Get('analytics/most-engaged')
  async getMostEngagedLeads(@Query('limit') limit?: string, @Request() req?: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.emailAnalyticsService.getMostEngagedLeads(
      req.user.workspaceId,
      limit ? parseInt(limit) : 20
    );
  }
}
