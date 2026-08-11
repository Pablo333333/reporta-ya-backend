import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateComunicadoDto {
  @IsString()
  @MinLength(10)
  mensaje: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value != null && value !== '' ? parseInt(value, 10) : undefined))
  duracionRestriccion?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value != null && value !== '' ? parseFloat(value) : undefined))
  latitud?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value != null && value !== '' ? parseFloat(value) : undefined))
  longitud?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value != null && value !== '' ? parseInt(value, 10) : undefined))
  radioMetros?: number;

  @IsOptional()
  @IsString()
  zona?: string;
}
