import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateReportStatusDto {
  @IsUUID()
  estadoId: string;

  @IsOptional()
  @IsString()
  comentarioResolucion?: string;
}
