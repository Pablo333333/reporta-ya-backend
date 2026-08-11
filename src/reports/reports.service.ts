import {
  ForbiddenException,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Reporte } from '@prisma/client';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { AiService } from '../ai/ai.service';
import { LlmService } from '../ai/llm.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { TenantContext } from '../common/tenant-context';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly aiService: AiService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Crea un nuevo reporte y notifica a todos los usuarios RESPONSABLE
   * que tengan un pushToken registrado.
   * Implementa lógica de Eventos Críticos y Gamificación.
   */
  async create(
    dto: CreateReportDto,
    photo: Express.Multer.File | undefined,
    audio: Express.Multer.File | undefined,
    usuario?: JwtPayload,
  ): Promise<Reporte> {
    const fotoUrl = photo ? (photo as any).path || (photo as any).secure_url : undefined;
    const audioUrl = audio ? (audio as any).path || (audio as any).secure_url : undefined;
    
    this.logger.debug(`[DEBUG] create - photo path: ${(photo as any)?.path}, secure_url: ${(photo as any)?.secure_url}`);
    this.logger.debug(`[DEBUG] create - fotoUrl final: ${fotoUrl}`);
    
    // Transcripción automática si hay audio
    let transcripcionVoz = dto.transcripcionVoz;
    if (audio) {
      const textoTranscribido = await this.aiService.transcribeAudio(audio);
      if (textoTranscribido) {
        transcripcionVoz = textoTranscribido;
      }
    }

    const { 
      esOffline, 
      categoriaId, 
      estadoId, 
      prioridadId, 
      valoresCamposExtra: rawValores, 
      transcripcionVoz: _, 
      territorioId: __, // Excluimos territorioId plano para evitar conflictos con la relación
      ...reportData 
    } = dto as any;

    // Parsear valoresCamposExtra si llegan como string (desde FormData)
    let valoresCamposExtra = rawValores;
    if (typeof rawValores === 'string') {
      try {
        valoresCamposExtra = JSON.parse(rawValores);
      } catch {
        valoresCamposExtra = null;
      }
    }

    // 1. Obtener estado inicial (Pendiente por defecto)
    let finalEstadoId = estadoId;
    if (!finalEstadoId) {
      // Búsqueda directa ignorando el filtro de tenant para estados globales (territorioId: null)
      const sqlResult = await (this.prisma as any).client.$queryRaw`SELECT id FROM "config_estados" WHERE "nombre" ILIKE 'Pendiente' LIMIT 1`;
      
      if (Array.isArray(sqlResult) && sqlResult.length > 0) {
        finalEstadoId = sqlResult[0].id;
      } else {
        throw new NotFoundException('Estado "Pendiente" no configurado en la base de datos');
      }
    }

    // 2. Lógica de EVENTO CRÍTICO: 2+ reportes en la misma zona/categoría (últimas 48h)
    let finalPrioridadId = prioridadId;
    let esEventoCritico = false;
    const cuarentaYOchoHorasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000);

    if (reportData.zona) {
      const reportesSimilares = await this.prisma.reporte.count({
        where: {
          zona: reportData.zona,
          categoriaId,
          fechaCreacion: { gte: cuarentaYOchoHorasAtras },
          estado: { esFinal: false } // No solucionados
        }
      });

      if (reportesSimilares >= 2) {
        esEventoCritico = true;
        const prioridadUrgente = await this.prisma.configPrioridad.findFirst({
          where: { nombre: { equals: 'Urgente', mode: 'insensitive' } }
        });
        if (prioridadUrgente) finalPrioridadId = prioridadUrgente.id;
      }
    }

    const data: Prisma.ReporteCreateInput = {
      ...reportData,
      fotoUrl,
      audioUrl,
      transcripcionVoz,
      valoresCamposExtra,
      ...(esOffline && { sincronizadoEn: new Date() }),
      categoria: { connect: { id: categoriaId } },
      estado: { connect: { id: finalEstadoId } },
      prioridad: { connect: { id: finalPrioridadId } },
    } as any;

    // DEFENSA CRÍTICA: Eliminamos campos que Prisma rechaza en el create
    // El aislamiento de territorio lo maneja automáticamente la extensión de PrismaService
    delete (data as any).territorioId;
    delete (data as any).id;

    if (usuario?.sub) {
      data.reportante = { connect: { id: usuario.sub } };
    }

    const reporte = await this.prisma.reporte.create({ 
      data,
      include: { 
        reportante: true,
        categoria: true,
        estado: true,
        prioridad: true,
      }
    });

    // 3. Lógica de Gamificación: +5 puntos para el REPORTANTE
    if (usuario?.sub && usuario.rol === 'REPORTANTE') {
      await this.prisma.puntosCiudadanos.create({
        data: {
          usuarioId: usuario.sub,
          puntos: 5,
          motivo: `Reporte creado: ${reporte.id}`,
        },
      });
    }

    // Auditoría inicial
    await this.prisma.historialReporte.create({
      data: {
        reporteId: reporte.id,
        usuarioId: usuario?.sub,
        estadoNuevoId: finalEstadoId!,
        comentario: esEventoCritico ? 'Reporte creado (EVENTO CRÍTICO)' : 'Reporte creado',
      },
    });

    // Notificar con título dinámico
    const tituloNotificacion = esEventoCritico 
      ? "🚨 ¡EVENTO CRÍTICO DETECTADO!" 
      : "Nuevo reporte en la vía";

    // 1. Notificar a los Responsables Operativos
    this.notifyResponsables(reporte.id, reporte.categoria.nombre, tituloNotificacion).catch(() => null);

    // 2. Notificar al Ciudadano (Reportante)
    if (reporte.reportante?.pushToken) {
      this.notificationsService.sendPushNotification(
        reporte.reportante.pushToken,
        "¡Tu reporte ya fue recibido! 🚀",
        `Estamos revisando tu reporte sobre "${reporte.categoria.nombre}". ¡Gracias por colaborar!`
      ).catch(() => null);
    }

    // 3. Alerta Crítica por Mensajería Instantánea
    if (esEventoCritico) {
      this.notificationsService.sendInstantMessengerAlert(
        `🚨 ALERTA CRÍTICA: Zona "${reporte.zona}" en ROJO por acumulación de incidentes (${reporte.categoria.nombre}). Score de Riesgo Territorial elevado.`
      ).catch(() => null);
    } else if (reporte.prioridad.nivel >= 3) {
      // Prioridad Alta (nivel >= 3)
      this.notificationsService.sendInstantMessengerAlert(
        `⚠️ REPORTE URGENTE: Se ha recibido un incidente de prioridad alta en la zona "${reporte.zona}".`
      ).catch(() => null);
    }

    return reporte;
  }

  private async notifyResponsables(
    reporteId: string, 
    categoriaNombre: string, 
    titulo: string = 'Nuevo reporte en la vía'
  ): Promise<void> {
    const responsables = await this.prisma.usuario.findMany({
      where: { rol: { nombre: 'RESPONSABLE' }, pushToken: { not: null } },
      select: { pushToken: true },
    });

    const tokens = responsables.map((u) => u.pushToken).filter((t): t is string => t !== null);
    if (tokens.length === 0) return;

    await this.notificationsService.sendPushNotifications(
      tokens,
      titulo,
      `Categoría: ${categoriaNombre}. Revisá el mapa.`,
      { reporteId },
    );
  }

  /**
   * Cálculo dinámico del Índice de Riesgo Territorial.
   * FÓRMULA ARQUITECTÓNICA: 0.6 * Gravedad + 0.4 * Frecuencia.
   * 
   * Justificación: Se prioriza la gravedad intrínseca del incidente (60%) 
   * sobre la acumulación histórica (40%) para garantizar que eventos críticos 
   * aislados no sean ignorados por falta de repetición.
   */
  private async calculateRiskIndex(reporte: any): Promise<number> {
    const gravedad = reporte.prioridad?.nivel || 1;
    const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const frecuencia = await this.prisma.reporte.count({
      where: {
        zona: reporte.zona,
        categoriaId: reporte.categoriaId,
        fechaCreacion: { gte: sieteDiasAtras },
        estado: { esFinal: false }
      }
    });

    // Obtener pesos dinámicos de la configuración
    const configs = await this.prisma.configSistema.findMany({
      where: { clave: { in: ['PESO_GRAVEDAD', 'PESO_FRECUENCIA'] } }
    });

    const pesoGravedad = parseFloat(configs.find(c => c.clave === 'PESO_GRAVEDAD')?.valor || '0.6');
    const pesoFrecuencia = parseFloat(configs.find(c => c.clave === 'PESO_FRECUENCIA')?.valor || '0.4');

    return parseFloat(((gravedad * pesoGravedad) + (frecuencia * pesoFrecuencia)).toFixed(2));
  }

  async findAll(skip: number = 0, estadoId?: string, userRol?: string): Promise<any[]> {
    const where: Prisma.ReporteWhereInput = {};
    if (estadoId) where.estadoId = estadoId;
    if (userRol === 'REPORTANTE') where.estado = { esFinal: false };

    const reportes = await this.prisma.reporte.findMany({
      where,
      include: { 
        reportante: { omit: { password: true } },
        categoria: true,
        estado: true,
        prioridad: true,
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 1000, // Aumentado de 20 para permitir ver más reportes en el mapa
      skip,
    });

    return Promise.all(reportes.map(async (r) => ({
      ...r,
      indiceRiesgo: await this.calculateRiskIndex(r)
    })));
  }

  async getPrioritized(skip: number = 0): Promise<any[]> {
    const reportes = await this.prisma.reporte.findMany({
      where: { estado: { esFinal: false } },
      include: { 
        reportante: { omit: { password: true } },
        categoria: true,
        estado: true,
        prioridad: true,
      },
    });

    const prioritized = await Promise.all(reportes.map(async (r) => ({
      ...r,
      indiceRiesgo: await this.calculateRiskIndex(r)
    })));

    return prioritized
      .sort((a, b) => b.indiceRiesgo - a.indiceRiesgo)
      .slice(skip, skip + 20);
  }

  /**
   * Obtiene el ranking de ciudadanos por puntos acumulados.
   */
  async getRankingCiudadano(): Promise<any[]> {
    const ranking = await this.prisma.usuario.findMany({
      where: { rol: { nombre: 'REPORTANTE' } },
      select: {
        id: true,
        email: true,
        _count: { select: { puntos: true } },
        puntos: {
          select: { puntos: true }
        }
      }
    });

    return ranking
      .map(u => ({
        id: u.id,
        email: u.email,
        totalPuntos: u.puntos.reduce((acc, p) => acc + p.puntos, 0)
      }))
      .sort((a, b) => b.totalPuntos - a.totalPuntos);
  }

  /**
   * Validación ciudadana y reapertura automática.
   */
  async validarSolucion(
    reporteId: string, 
    aprobado: boolean, 
    comentarioCiudadano?: string,
    usuario?: JwtPayload
  ): Promise<Reporte> {
    const reporte = await this.prisma.reporte.findUnique({ where: { id: reporteId } });
    if (!reporte) throw new NotFoundException(`Reporte ${reporteId} no encontrado`);

    if (aprobado) {
      const updated = await this.prisma.reporte.update({
        where: { id: reporteId },
        data: { validadoCiudadano: true },
        include: { reportante: true }
      });

      // Gamificación: +15 puntos por validación exitosa
      if (updated.reportanteId) {
        await this.prisma.puntosCiudadanos.create({
          data: {
            usuarioId: updated.reportanteId,
            puntos: 15,
            motivo: `Validación exitosa de reporte: ${reporteId}`,
          },
        });
      }

      return updated;
    } else {
      // Reapertura automática
      const estadoPendiente = await this.prisma.configEstado.findFirst({
        where: { nombre: { equals: 'Pendiente', mode: 'insensitive' } }
      });
      if (!estadoPendiente) throw new NotFoundException('Estado "Pendiente" no configurado');

      const updatedReporte = await this.prisma.reporte.update({
        where: { id: reporteId },
        data: { 
          validadoCiudadano: false,
          estadoId: estadoPendiente.id
        }
      });

      // Auditoría de reapertura
      await this.prisma.historialReporte.create({
        data: {
          reporteId,
          usuarioId: usuario?.sub,
          estadoAnteriorId: reporte.estadoId,
          estadoNuevoId: estadoPendiente.id,
          comentario: `REAPERTURA CIUDADANA: ${comentarioCiudadano || 'Sin comentario'}`
        }
      });

      return updatedReporte;
    }
  }

  /**
   * Motor híbrido de clasificación: keywords dinámicas + LLM (Gemini/OpenAI) + fallback.
   */
  async sugerirCategoria(texto: string): Promise<{
    categoriaId: string | undefined;
    categoriaNombre: string | undefined;
    prioridadId: string | undefined;
    prioridadNombre: string;
    prioridadSugerida: string;
    confianza: number;
    razon: string;
    metodo: string;
    provider?: string;
  }> {
    const [categorias, prioridades] = await Promise.all([
      this.prisma.configCategoria.findMany({ where: { activo: true } }),
      this.prisma.configPrioridad.findMany({ where: { activo: true } }),
    ]);

    const sugerenciaIA = await this.llmService.clasificarReporte(texto);

    const cat =
      categorias.find(
        (c) => c.nombre.toLowerCase() === sugerenciaIA.categoria.toLowerCase(),
      ) || categorias[0];

    const prio =
      prioridades.find(
        (p) => p.nombre.toLowerCase() === sugerenciaIA.prioridad.toLowerCase(),
      ) ||
      prioridades.find((p) => /baja/i.test(p.nombre)) ||
      prioridades[0];

    return {
      categoriaId: cat?.id,
      categoriaNombre: cat?.nombre,
      prioridadId: prio?.id,
      prioridadNombre: prio?.nombre || sugerenciaIA.prioridad,
      prioridadSugerida: sugerenciaIA.prioridad,
      confianza: sugerenciaIA.confianza,
      razon: sugerenciaIA.razon,
      metodo: sugerenciaIA.metodo,
      provider: sugerenciaIA.provider,
    };
  }

  /**
   * Dashboard analítico: KPIs, tiempos de atención (historial),
   * desglose por categoría/zona y ranking de responsables.
   */
  async getAnalytics(from?: string, to?: string): Promise<any> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Parámetros from/to inválidos (usar ISO-8601)');
    }

    const periodoFilter = {
      fechaCreacion: { gte: fromDate, lte: toDate },
    };

    const [reportes, estados] = await Promise.all([
      this.prisma.reporte.findMany({
        where: periodoFilter,
        include: {
          categoria: true,
          estado: true,
          prioridad: true,
          historial: {
            include: {
              estadoNuevo: true,
              usuario: {
                select: {
                  id: true,
                  email: true,
                  rol: { select: { nombre: true } },
                },
              },
            },
            orderBy: { fecha: 'asc' },
          },
        },
      }),
      this.prisma.configEstado.findMany(),
    ]);

    const countByEstadoNombre = (nombre: string) =>
      reportes.filter(
        (r) => r.estado.nombre.toLowerCase() === nombre.toLowerCase(),
      ).length;

    const tiemposHoras: number[] = [];
    for (const r of reportes) {
      const horas = this.calcularTiempoAtencionHoras(r);
      if (horas != null) tiemposHoras.push(horas);
    }

    const porCategoriaMap = new Map<
      string,
      { categoriaId: string; nombre: string; total: number; abiertos: number }
    >();
    for (const r of reportes) {
      const key = r.categoriaId;
      const entry = porCategoriaMap.get(key) || {
        categoriaId: r.categoriaId,
        nombre: r.categoria.nombre,
        total: 0,
        abiertos: 0,
      };
      entry.total += 1;
      if (!r.estado.esFinal) entry.abiertos += 1;
      porCategoriaMap.set(key, entry);
    }

    const porZonaMap = new Map<
      string,
      {
        zona: string;
        total: number;
        abiertos: number;
        sumaNivel: number;
      }
    >();
    for (const r of reportes) {
      const zona = r.zona?.trim() || 'Sin zona';
      const entry = porZonaMap.get(zona) || {
        zona,
        total: 0,
        abiertos: 0,
        sumaNivel: 0,
      };
      entry.total += 1;
      if (!r.estado.esFinal) entry.abiertos += 1;
      entry.sumaNivel += r.prioridad?.nivel || 1;
      porZonaMap.set(zona, entry);
    }

    const rankingMap = new Map<
      string,
      {
        usuarioId: string;
        email: string;
        resueltos: number;
        reaperturas: number;
        sumaHoras: number;
        nTiempos: number;
      }
    >();

    for (const r of reportes) {
      for (const h of r.historial) {
        const rolNombre =
          typeof h.usuario?.rol === 'object'
            ? (h.usuario.rol as any)?.nombre
            : undefined;
        if (!h.usuarioId || !h.usuario) continue;
        if (rolNombre !== 'RESPONSABLE' && rolNombre !== 'SUPERVISOR') continue;

        const entry = rankingMap.get(h.usuarioId) || {
          usuarioId: h.usuarioId,
          email: h.usuario.email,
          resueltos: 0,
          reaperturas: 0,
          sumaHoras: 0,
          nTiempos: 0,
        };

        const esReapertura =
          h.estadoNuevo.nombre.toLowerCase() === 'reabierto' ||
          (h.comentario || '').toUpperCase().startsWith('REAPERTURA');

        if (esReapertura) {
          entry.reaperturas += 1;
        } else if (h.estadoNuevo.esFinal) {
          entry.resueltos += 1;
          const horas =
            (h.fecha.getTime() - r.fechaCreacion.getTime()) / (1000 * 60 * 60);
          if (horas >= 0) {
            entry.sumaHoras += horas;
            entry.nTiempos += 1;
          }
        }

        rankingMap.set(h.usuarioId, entry);
      }
    }

    const tendenciaMap = new Map<string, number>();
    for (const r of reportes) {
      const day = r.fechaCreacion.toISOString().slice(0, 10);
      tendenciaMap.set(day, (tendenciaMap.get(day) || 0) + 1);
    }

    const tendenciaDiaria = Array.from(tendenciaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, total]) => ({ fecha, total }));

    return {
      periodo: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      kpis: {
        total: reportes.length,
        pendientes: countByEstadoNombre('Pendiente'),
        enProceso: countByEstadoNombre('En Proceso'),
        solucionados: countByEstadoNombre('Solucionado'),
        reabiertos: countByEstadoNombre('Reabierto'),
        tiempoAtencion: {
          promedioHoras: this.avg(tiemposHoras),
          medianaHoras: this.percentile(tiemposHoras, 0.5),
          p90Horas: this.percentile(tiemposHoras, 0.9),
          nMuestra: tiemposHoras.length,
        },
      },
      porCategoria: Array.from(porCategoriaMap.values()).sort(
        (a, b) => b.total - a.total,
      ),
      porZona: Array.from(porZonaMap.values())
        .map((z) => ({
          zona: z.zona,
          total: z.total,
          abiertos: z.abiertos,
          indiceRiesgoPromedio: Number((z.sumaNivel / z.total).toFixed(2)),
        }))
        .sort((a, b) => b.total - a.total),
      rankingResponsables: Array.from(rankingMap.values())
        .map((r) => ({
          usuarioId: r.usuarioId,
          email: r.email,
          resueltos: r.resueltos,
          reaperturas: r.reaperturas,
          tiempoMedioHoras:
            r.nTiempos > 0
              ? Number((r.sumaHoras / r.nTiempos).toFixed(2))
              : null,
        }))
        .sort((a, b) => b.resueltos - a.resueltos || a.reaperturas - b.reaperturas),
      tendenciaDiaria,
      // metadata útil para UI
      estadosDisponibles: estados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        esFinal: e.esFinal,
      })),
    };
  }

  /**
   * Tiempo hasta la última resolución final posterior a la última reapertura.
   */
  private calcularTiempoAtencionHoras(reporte: {
    fechaCreacion: Date;
    historial: Array<{
      fecha: Date;
      comentario: string | null;
      estadoNuevo: { nombre: string; esFinal: boolean };
    }>;
  }): number | null {
    const events = reporte.historial;
    if (!events.length) return null;

    let lastReopenIdx = -1;
    for (let i = 0; i < events.length; i++) {
      const h = events[i];
      const isReopen =
        h.estadoNuevo.nombre.toLowerCase() === 'reabierto' ||
        (h.comentario || '').toUpperCase().startsWith('REAPERTURA');
      if (isReopen) lastReopenIdx = i;
    }

    const slice = events.slice(lastReopenIdx + 1);
    const cierre = slice.find((h) => h.estadoNuevo.esFinal);
    if (!cierre) return null;

    const horas =
      (cierre.fecha.getTime() - reporte.fechaCreacion.getTime()) /
      (1000 * 60 * 60);
    return horas >= 0 ? Number(horas.toFixed(2)) : null;
  }

  private avg(values: number[]): number | null {
    if (!values.length) return null;
    return Number(
      (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    );
  }

  private percentile(values: number[], p: number): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(p * sorted.length) - 1),
    );
    return Number(sorted[idx].toFixed(2));
  }

  async getStats(): Promise<any> {
    const stats = await this.prisma.configEstado.findMany({
      include: { _count: { select: { reportes: true } } }
    });
    const total = await this.prisma.reporte.count();
    const result = { total };
    stats.forEach((s: any) => { result[s.nombre.toLowerCase()] = s._count.reportes; });
    return result;
  }

  async findOne(id: string): Promise<any> {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id },
      include: { 
        reportante: { omit: { password: true } },
        categoria: true,
        estado: true,
        prioridad: true,
        historial: {
          include: { 
            usuario: { select: { email: true, rol: true } },
            estadoAnterior: true,
            estadoNuevo: true,
          },
          orderBy: { fecha: 'desc' }
        }
      },
    });

    if (!reporte) throw new NotFoundException(`Reporte con id ${id} no encontrado`);

    return {
      ...reporte,
      indiceRiesgo: await this.calculateRiskIndex(reporte)
    };
  }

  async updateStatus(
    id: string,
    dto: UpdateReportStatusDto,
    fotoEvidencia: Express.Multer.File | undefined,
    usuario: JwtPayload,
  ): Promise<Reporte> {
    const reporte = await this.prisma.reporte.findUnique({ 
      where: { id },
      include: { categoria: true }
    });
    if (!reporte) throw new NotFoundException(`Reporte con id ${id} no encontrado`);

    this.logger.debug(`[DEBUG] updateStatus - Usuario recibido: ${JSON.stringify(usuario)}`);
    this.logger.debug(`[DEBUG] updateStatus - TenantContext.territorioId: ${TenantContext.territorioId}`);
    this.logger.debug(`[DEBUG] updateStatus - Reporte territorioId: ${reporte.territorioId}`);

    const userRol = typeof usuario.rol === 'object' ? (usuario.rol as any).nombre : usuario.rol;

    // Validación simplificada de territorio
    const esMismoTerritorio = (TenantContext.territorioId === reporte.territorioId);
    const esModoGlobal = (TenantContext.territorioId === null && reporte.territorioId === null);

    if (!esMismoTerritorio && !esModoGlobal) {
      throw new ForbiddenException('No tienes permiso para modificar reportes de otro territorio');
    }

    if (userRol !== 'RESPONSABLE' && userRol !== 'SUPERVISOR') {
      throw new ForbiddenException(`Solo los responsables o supervisores pueden actualizar el estado. Rol detectado: ${userRol}`);
    }

    // Validación de requerimiento de foto según el estado
    const nuevoEstado = await this.prisma.configEstado.findUnique({ where: { id: dto.estadoId } });
    if (nuevoEstado?.requiereFoto && !fotoEvidencia) {
      throw new ForbiddenException(`El estado "${nuevoEstado.nombre}" requiere una foto de evidencia para ser aplicado`);
    }

    // Lógica de APRENDIZAJE IA: Si el operador cambia la categoría
    if (dto.categoriaId && dto.categoriaId !== reporte.categoriaId) {
      const nuevaCategoria = await this.prisma.configCategoria.findUnique({ where: { id: dto.categoriaId } });
      if (nuevaCategoria) {
        await this.prisma.aprendizajeIa.create({
          data: {
            textoReporte: reporte.comentario || reporte.transcripcionVoz || 'Sin texto',
            categoriaSugerida: reporte.categoria.nombre,
            categoriaReal: nuevaCategoria.nombre,
            corregido: true,
          }
        });
      }
    }

    const fotoEvidenciaUrl = fotoEvidencia ? (fotoEvidencia as any).path || (fotoEvidencia as any).secure_url : undefined;

    this.logger.debug(`[DEBUG] updateStatus - fotoEvidencia path: ${(fotoEvidencia as any)?.path}, secure_url: ${(fotoEvidencia as any)?.secure_url}`);
    this.logger.debug(`[DEBUG] updateStatus - fotoEvidenciaUrl final: ${fotoEvidenciaUrl}`);

    const updatedReporte = await this.prisma.reporte.update({
      where: { id },
      data: {
        estadoId: dto.estadoId,
        ...(dto.categoriaId && { categoriaId: dto.categoriaId }),
        ...(dto.comentarioResolucion && { comentarioResolucion: dto.comentarioResolucion }),
        ...(fotoEvidenciaUrl && { fotoEvidenciaUrl }),
      },
    });

    await this.prisma.historialReporte.create({
      data: {
        reporteId: id,
        usuarioId: usuario.sub,
        estadoAnteriorId: reporte.estadoId,
        estadoNuevoId: dto.estadoId,
        comentario: dto.comentarioResolucion || 'Cambio de estado',
      },
    });

    return updatedReporte;
  }

  async findMine(usuarioId: string): Promise<Reporte[]> {
    return this.prisma.reporte.findMany({
      where: { reportanteId: usuarioId },
      include: { categoria: true, estado: true, prioridad: true },
      orderBy: { fechaCreacion: 'desc' },
    });
  }
}
