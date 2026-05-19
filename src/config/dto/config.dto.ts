import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSistemaDto {
  @IsString()
  @IsNotEmpty()
  valor: string;
}

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  color?: string;

  @IsString()
  icono?: string;
}
