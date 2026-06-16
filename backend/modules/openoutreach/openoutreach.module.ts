import { Module } from '@nestjs/common';
import { OpenOutreachService } from './openoutreach.service';
import { OpenOutreachController } from './openoutreach.controller';

@Module({
  controllers: [OpenOutreachController],
  providers: [OpenOutreachService],
  exports: [OpenOutreachService]
})
export class OpenOutreachModule {}
