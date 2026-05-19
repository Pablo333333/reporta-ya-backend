import { Injectable, NotFoundException } from '@nestjs/common';
import { Usuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type UsuarioSinPassword = Omit<Usuario, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UsuarioSinPassword[]> {
    return this.prisma.usuario.findMany({
      omit: { password: true },
    });
  }

  async findOne(id: string): Promise<UsuarioSinPassword> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      omit: { password: true },
    });

    if (!usuario) throw new NotFoundException(`Usuario con id ${id} no encontrado`);

    return usuario;
  }

  async savePushToken(userId: string, pushToken: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { pushToken },
    });
  }
}
