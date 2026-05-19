import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateComunicadoDto {
  @IsString()
  @MinLength(10)
  mensaje: string;

  @IsOptional()
  @IsInt()
  duracionRestriccion?: number;
}
