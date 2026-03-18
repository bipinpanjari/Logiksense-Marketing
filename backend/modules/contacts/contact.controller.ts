import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('api/contacts')
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Get(':leadId')
  async getContact(@Param('leadId') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.contactService.getContact(req.user.workspaceId, leadId);
  }

  @Post(':leadId/notes')
  async addNote(
    @Param('leadId') leadId: string,
    @Body('content') content: string,
    @Request() req: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.contactService.addNote(req.user.workspaceId, leadId, content, req.user.userId);
  }

  @Get(':leadId/activity')
  async getActivityLog(@Param('leadId') leadId: string, @Request() req: any) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.contactService.getActivityLog(req.user.workspaceId, leadId);
  }

  @Post(':leadId/attachment')
  async addAttachment(
    @Param('leadId') leadId: string,
    @Body() body: { fileName: string; fileUrl: string },
    @Request() req: any
  ) {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
    return this.contactService.addAttachment(
      req.user.workspaceId,
      leadId,
      body.fileName,
      body.fileUrl,
      req.user.userId
    );
  }
}
