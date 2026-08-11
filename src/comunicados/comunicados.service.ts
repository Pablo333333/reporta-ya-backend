import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Comunicado } from '@prisma/client';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';

@Injectable()
export class ComunicadosService {
  private readonly logger = new Logger(ComunicadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateComunicadoDto, usuario: JwtPayload): Promise<Comunicado> {
    const comunicado = await this.prisma.comunicado.create({
      data: {
        mensaje: dto.mensaje,
        duracionRestriccion: dto.duracionRestriccion,
        latitud: dto.latitud,
        longitud: dto.longitud,
        radioMetros: dto.radioMetros,
        zona: dto.zona?.trim() || undefined,
        responsableId: usuario.sub,
      },
      include: { responsable: { omit: { password: true } } },
    });

    // Push masivo (fail-open): no bloquea la publicación
    this.notifyUsuarios(comunicado).catch((err) =>
      this.logger.warn(`Push comunicado falló: ${(err as Error).message}`),
    );

    return comunicado;
  }

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

  private async notifyUsuarios(comunicado: Comunicado): Promise<void> {
    const users = await this.prisma.usuario.findMany({
      where: { pushToken: { not: null } },
      select: { pushToken: true },
    });

    const tokens = users
      .map((u) => u.pushToken)
      .filter((t): t is string => !!t);

    if (!tokens.length) {
      this.logger.warn('Comunicado publicado sin destinatarios push.');
      return;
    }

    const plantillaRow = await this.prisma.configMensajeAuto.findFirst({
      where: { tipo: 'COMUNICADO', activo: true },
    });
    const plantilla =
      plantillaRow?.plantilla ||
      '📢 Comunicado{{zonaSuffix}}: {{mensaje}}';

    const zonaSuffix = comunicado.zona ? ` (${comunicado.zona})` : '';
    const body = plantilla
      .replace(/\{\{zonaSuffix\}\}/g, zonaSuffix)
      .replace(/\{\{zona\}\}/g, comunicado.zona || '')
      .replace(/\{\{mensaje\}\}/g, comunicado.mensaje.substring(0, 160));

    const titulo = comunicado.zona
      ? `Comunicado · ${comunicado.zona}`
      : 'Nuevo comunicado';

    await this.notificationsService.sendPushNotifications(
      tokens,
      titulo,
      body,
      {
        tipo: 'COMUNICADO',
        comunicadoId: comunicado.id,
        zona: comunicado.zona || undefined,
        latitud: comunicado.latitud ?? undefined,
        longitud: comunicado.longitud ?? undefined,
        radioMetros: comunicado.radioMetros ?? undefined,
      },
    );
  }
}
