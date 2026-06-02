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

  async getCategorias(): Promise<any[]> {
    return this.prisma.configCategoria.findMany({
      include: { camposExtra: true },
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

  // ─── Campos Extra ──────────────────────────────────────────────────────────

  async createCampoExtra(data: any) {
    return this.prisma.configCampoExtra.create({
      data,
    });
  }

  async deleteCampoExtra(id: string) {
    return this.prisma.configCampoExtra.delete({
      where: { id },
    });
  }

  // ─── Estados ───────────────────────────────────────────────────────────────

  async getEstados(): Promise<ConfigEstado[]> {
    return this.prisma.configEstado.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
  }

  async createEstado(data: any): Promise<ConfigEstado> {
    return this.prisma.configEstado.create({
      data,
    });
  }

  async updateEstado(id: string, data: any): Promise<ConfigEstado> {
    return this.prisma.configEstado.update({
      where: { id },
      data,
    });
  }

  // ─── Prioridades ───────────────────────────────────────────────────────────

  async getPrioridades(): Promise<ConfigPrioridad[]> {
    return this.prisma.configPrioridad.findMany({
      where: { activo: true },
      orderBy: { nivel: 'asc' },
    });
  }

  async createPrioridad(data: any): Promise<ConfigPrioridad> {
    return this.prisma.configPrioridad.create({
      data,
    });
  }

  async updatePrioridad(id: string, data: any): Promise<ConfigPrioridad> {
    return this.prisma.configPrioridad.update({
      where: { id },
      data,
    });
  }

  // ─── Roles y Permisos ──────────────────────────────────────────────────────

  async getRoles() {
    return this.prisma.rol.findMany({
      include: { permisos: { include: { permiso: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async getPermisos() {
    return this.prisma.permiso.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async getTerritorios() {
    return this.prisma.territorio.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async getLogs(params: { usuarioId?: string; accion?: string; territorioId?: string }) {
    const logs = await this.prisma.logAccion.findMany({
      where: {
        ...(params.usuarioId && { usuarioId: params.usuarioId }),
        ...(params.accion && { accion: { contains: params.accion, mode: 'insensitive' } }),
        ...(params.territorioId && {
          usuario: {
            territorioId: params.territorioId,
          },
        }),
      },
      include: { usuario: { select: { email: true, territorioId: true } } },
      orderBy: { fecha: 'desc' },
      take: 100,
    });
    console.log(`[DEBUG] GlobalConfigService.getLogs - Encontrados ${logs.length} logs`);
    if (logs.length === 0) {
      const totalSinFiltro = await this.prisma.logAccion.count();
      console.log(`[DEBUG] GlobalConfigService.getLogs - Total en tabla (sin filtros): ${totalSinFiltro}`);
    }
    return logs;
  }

  async updateRolPermisos(rolId: string, permisoIds: string[]) {
    // Eliminar permisos actuales
    await this.prisma.rolPermiso.deleteMany({
      where: { rolId },
    });

    // Crear nuevas relaciones
    const data = permisoIds.map(permisoId => ({
      rolId,
      permisoId,
    }));

    return this.prisma.rolPermiso.createMany({
      data,
    });
  }
}
