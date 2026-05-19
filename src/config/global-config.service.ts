import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigCategoria, ConfigEstado, ConfigPrioridad, ConfigSistema } from '@prisma/client';

@Injectable()
export class GlobalConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Sistema ───────────────────────────────────────────────────────────────

  async getSistema(): Promise<ConfigSistema[]> {
    return this.prisma.configSistema.findMany({
      orderBy: { clave: 'asc' },
    });
  }

  async updateSistema(clave: string, valor: string): Promise<ConfigSistema> {
    const config = await this.prisma.configSistema.findUnique({
      where: { clave },
    });

    if (!config) {
      throw new NotFoundException(`Configuración con clave "${clave}" no encontrada`);
    }

    return this.prisma.configSistema.update({
      where: { clave },
      data: { valor },
    });
  }

  // ─── Categorías ────────────────────────────────────────────────────────────

  async getCategorias(): Promise<ConfigCategoria[]> {
    return this.prisma.configCategoria.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async createCategoria(data: any): Promise<ConfigCategoria> {
    return this.prisma.configCategoria.create({
      data,
    });
  }

  async updateCategoria(id: string, data: any): Promise<ConfigCategoria> {
    return this.prisma.configCategoria.update({
      where: { id },
      data,
    });
  }

  // ─── Estados ───────────────────────────────────────────────────────────────

  async getEstados(): Promise<ConfigEstado[]> {
    return this.prisma.configEstado.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
  }

  // ─── Prioridades ───────────────────────────────────────────────────────────

  async getPrioridades(): Promise<ConfigPrioridad[]> {
    return this.prisma.configPrioridad.findMany({
      where: { activo: true },
      orderBy: { nivel: 'asc' },
    });
  }
}
