import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  categoriaId: string;

  @IsOptional()
  @IsUUID()
  estadoId?: string;

  @IsUUID()
  prioridadId: string;

  @IsOptional()
  @IsString()
  zona?: string;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  transcripcionVoz?: string;

  /**
   * Latitud llega como string desde FormData multipart.
   * @Transform la convierte a number antes de la validación.
   */
  @Transform(({ value }) => (value != null ? parseFloat(value as string) : value))
  @IsNumber()
  latitud: number;

  /**
   * Longitud llega como string desde FormData multipart.
   * @Transform la convierte a number antes de la validación.
   */
  @Transform(({ value }) => (value != null ? parseFloat(value as string) : value))
  @IsNumber()
  longitud: number;

  /**
   * Indica que el reporte se creó offline y se está sincronizando ahora.
   * El servidor registrará la fecha de sincronización en sincronizadoEn.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  esOffline?: boolean;
}
