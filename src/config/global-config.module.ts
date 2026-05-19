import { Module } from '@nestjs/common';
import { GlobalConfigService } from './global-config.service';
import { GlobalConfigController } from './global-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GlobalConfigController],
  providers: [GlobalConfigService],
  exports: [GlobalConfigService],
})
export class GlobalConfigModule {}
