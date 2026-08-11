import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadModule } from '../upload/upload.module';
import { AiModule } from '../ai/ai.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SlaMonitorService } from './sla-monitor.service';

@Module({
  imports: [UploadModule, NotificationsModule, MailModule, AiModule],
  controllers: [ReportsController],
  providers: [ReportsService, SlaMonitorService],
})
export class ReportsModule {}
