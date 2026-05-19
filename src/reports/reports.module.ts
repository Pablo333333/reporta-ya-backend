import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadModule } from '../upload/upload.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [UploadModule, NotificationsModule, MailModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
