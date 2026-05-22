import {
  ForbiddenException,
  Injectable,
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

@Injectable()
export class ReportsService {
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
    const fotoUrl = photo ? (photo as any).path : undefined;
    const audioUrl = audio ? (audio as any).path : undefined;
    
    // Transcripción automática si hay audio
    let transcripcionVoz = dto.transcripcionVoz;
    if (audio) {
      const textoTranscribido = await this.aiService.transcribeAudio(audio);
      if (textoTranscribido) {
        transcripcionVoz = textoTranscribido;
      }
    }

    const { esOffline, categoriaId, estadoId, prioridadId, valoresCamposExtra: rawValores, transcripcionVoz: _, ...reportData } = dto;

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
      const estadoPendiente = await this.prisma.configEstado.findFirst({
        where: { nombre: { equals: 'Pendiente', mode: 'insensitive' } },
      });
      if (!estadoPendiente) throw new NotFoundException('Estado "Pendiente" no configurado');
      finalEstadoId = estadoPendiente.id;
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

    // 3. Lógica de Gamificación: +10 puntos para el REPORTANTE
    if (usuario?.sub && usuario.rol === 'REPORTANTE') {
      await this.prisma.puntosCiudadanos.create({
        data: {
          usuarioId: usuario.sub,
          puntos: 10,
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
      take: 20,
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
      return this.prisma.reporte.update({
        where: { id: reporteId },
        data: { validadoCiudadano: true }
      });
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
   * Motor Híbrido de Clasificación de IA Ligera.
   */
  async sugerirCategoria(texto: string): Promise<any> {
    const t = texto.toLowerCase();
    
    // 1. Mapeo por palabras clave (Costo cero)
    const keywordsAmbiental = ["basura", "desmonte", "río", "contaminacion", "residuos"];
    const keywordsVial = ["piedras", "derrumbe", "vía", "bache", "hueco", "asfalto"];

    let sugerenciaNombre = "";
    if (keywordsAmbiental.some(k => t.includes(k))) sugerenciaNombre = "Ambiental";
    else if (keywordsVial.some(k => t.includes(k))) sugerenciaNombre = "Vial";

    // 2. Motor de IA (LLM Integration)
    const categoriasDisponibles = await this.prisma.configCategoria.findMany({ where: { activo: true } });
    
    // El LlmService ahora hace su propio fetch dinámico de categorías y estados
    const sugerenciaIA = await this.llmService.clasificarReporte(texto);
    
    const cat = categoriasDisponibles.find(c => 
      c.nombre.toLowerCase() === sugerenciaIA.categoria.toLowerCase()
    );

    return { 
      categoriaId: cat?.id || categoriasDisponibles[0]?.id, 
      nombre: cat?.nombre || categoriasDisponibles[0]?.nombre, 
      prioridadSugerida: sugerenciaIA.prioridad,
      razon: sugerenciaIA.razon,
      metodo: sugerenciaNombre ? "Híbrido (Keywords + LLM)" : "LLM (OpenAI/Gemini)" 
    };
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

    if (usuario.rol !== 'RESPONSABLE') {
      throw new ForbiddenException('Solo los responsables pueden actualizar el estado');
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

    const fotoEvidenciaUrl = fotoEvidencia ? (fotoEvidencia as any).path : undefined;

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
