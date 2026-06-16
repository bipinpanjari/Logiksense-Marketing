import { Controller, Get } from '@nestjs/common';
import { OpenOutreachService } from './openoutreach.service';

@Controller('api/openoutreach')
export class OpenOutreachController {
  constructor(private readonly openOutreachService: OpenOutreachService) {}

  @Get('status')
  getStatus() {
    return this.openOutreachService.getStatus();
  }
}
