import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const SLA_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

@Injectable()
export class SlaMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaMonitorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    // Primera pasada a los 30s (dar tiempo a que arranque la app)
    setTimeout(() => {
      this.verificarSla().catch((e) =>
        this.logger.warn(`SLA inicial falló: ${(e as Error).message}`),
      );
    }, 30_000);

    this.timer = setInterval(() => {
      this.verificarSla().catch((e) =>
        this.logger.warn(`SLA periódico falló: ${(e as Error).message}`),
      );
    }, SLA_CHECK_INTERVAL_MS);

    this.logger.log('Monitor SLA activo (cada 15 min).');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Marca reportes abiertos que superan SLA_HORAS_LIMITE y alerta a responsables (1 vez).
   */
  async verificarSla(): Promise<{
    evaluados: number;
    incumplidosNuevos: number;
    alertados: number;
  }> {
    const horasLimite = await this.getSlaHoras();
    const limiteDesde = new Date(Date.now() - horasLimite * 60 * 60 * 1000);

    const vencidos = await this.prisma.reporte.findMany({
      where: {
        estado: { esFinal: false },
        fechaCreacion: { lte: limiteDesde },
        OR: [{ slaIncumplido: false }, { slaAlertadoEn: null }],
      },
      include: {
        categoria: true,
        estado: true,
      },
      take: 100,
    });

    if (!vencidos.length) {
      return { evaluados: 0, incumplidosNuevos: 0, alertados: 0 };
    }

    let incumplidosNuevos = 0;
    let alertados = 0;

    const plantilla = await this.getPlantilla('SLA_INCUMPLIDO');
    const tokens = await this.getResponsableTokens();

    for (const r of vencidos) {
      const yaIncumplido = r.slaIncumplido;
      const yaAlertado = !!r.slaAlertadoEn;

      await this.prisma.reporte.update({
        where: { id: r.id },
        data: {
          slaIncumplido: true,
          ...(!yaAlertado && tokens.length > 0
            ? { slaAlertadoEn: new Date() }
            : {}),
        },
      });

      if (!yaIncumplido) incumplidosNuevos += 1;

      if (!yaAlertado && tokens.length > 0) {
        const body = this.render(plantilla, {
          categoria: r.categoria?.nombre || 'Sin categoría',
          zona: r.zona || 'Sin zona',
          horas: String(horasLimite),
          reporteId: r.id,
        });

        await this.notificationsService.sendPushNotifications(
          tokens,
          '⏱ SLA incumplido',
          body,
          { reporteId: r.id, tipo: 'SLA_INCUMPLIDO' },
        );
        alertados += 1;
      }
    }

    this.logger.log(
      `SLA check: ${vencidos.length} vencidos, ${incumplidosNuevos} nuevos, ${alertados} alertas.`,
    );

    return {
      evaluados: vencidos.length,
      incumplidosNuevos,
      alertados,
    };
  }

  private async getSlaHoras(): Promise<number> {
    const row = await this.prisma.configSistema.findUnique({
      where: { clave: 'SLA_HORAS_LIMITE' },
    });
    const n = Number(row?.valor);
    return Number.isFinite(n) && n > 0 ? n : 48;
  }

  private async getPlantilla(tipo: string): Promise<string> {
    const row = await this.prisma.configMensajeAuto.findFirst({
      where: { tipo, activo: true },
    });
    return (
      row?.plantilla ||
      '⏱ SLA incumplido: reporte {{categoria}} en {{zona}} lleva más de {{horas}}h sin resolución.'
    );
  }

  private async getResponsableTokens(): Promise<string[]> {
    const users = await this.prisma.usuario.findMany({
      where: {
        rol: { nombre: { in: ['RESPONSABLE', 'SUPERVISOR'] } },
        pushToken: { not: null },
      },
      select: { pushToken: true },
    });
    return users
      .map((u) => u.pushToken)
      .filter((t): t is string => !!t);
  }

  private render(
    plantilla: string,
    vars: Record<string, string>,
  ): string {
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
      plantilla,
    );
  }
}
