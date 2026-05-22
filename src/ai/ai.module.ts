import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';

@Module({
  imports: [ConfigModule],
  providers: [AiService, LlmService],
  exports: [AiService, LlmService],
})
export class AiModule {}
