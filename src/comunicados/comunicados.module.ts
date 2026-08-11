import { Module } from '@nestjs/common';
import { ComunicadosController } from './comunicados.controller';
import { ComunicadosService } from './comunicados.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ComunicadosController],
  providers: [ComunicadosService],
})
export class ComunicadosModule {}
