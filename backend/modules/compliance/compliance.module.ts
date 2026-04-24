import { Module } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { GdprController } from './gdpr.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

@Module({
  controllers: [GdprController, AuditLogController],
  providers: [GdprService, AuditLogService],
  exports: [GdprService, AuditLogService],
})
export class ComplianceModule {}
