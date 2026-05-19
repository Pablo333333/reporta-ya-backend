import { Injectable, NotFoundException } from '@nestjs/common';
import { Comunicado } from '@prisma/client';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';

@Injectable()
export class ComunicadosService {
  constructor(private readonly prisma: PrismaService) {}

  // RESPONSABLE / SUPERVISOR: publica un comunicado
  async create(dto: CreateComunicadoDto, usuario: JwtPayload): Promise<Comunicado> {
    return this.prisma.comunicado.create({
      data: {
        ...dto,
        responsableId: usuario.sub,
      },
      include: { responsable: { omit: { password: true } } },
    });
  }

  // Todos los usuarios autenticados pueden ver los comunicados
  async findAll(): Promise<Comunicado[]> {
    return this.prisma.comunicado.findMany({
      include: { responsable: { omit: { password: true } } },
      orderBy: { fechaPublicacion: 'desc' },
    });
  }

  async findOne(id: string): Promise<Comunicado> {
    const comunicado = await this.prisma.comunicado.findUnique({
      where: { id },
      include: { responsable: { omit: { password: true } } },
    });

    if (!comunicado) throw new NotFoundException(`Comunicado con id ${id} no encontrado`);

    return comunicado;
  }
}
