import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Headers,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditAction } from '../common/decorators/audit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { multerOptions } from '../upload/upload.config';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';
import { SlaMonitorService } from './sla-monitor.service';

@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  constructor(
    private readonly reportsService: ReportsService,
    private readonly slaMonitorService: SlaMonitorService,
  ) {}

  // POST /reports — Usuarios autenticados o Invitados (Anónimos)
  @Post()
  @Public()
  @UseGuards(OptionalJwtAuthGuard, RolesGuard)
  @Roles('REPORTANTE', 'RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CREATE_REPORT')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'photo', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ], multerOptions))
  create(
    @Body() dto: CreateReportDto,
    @UploadedFiles() files: { photo?: Express.Multer.File[], audio?: Express.Multer.File[] },
    @CurrentUser() user?: JwtPayload,
  ) {
    const photo = files?.photo?.[0];
    const audio = files?.audio?.[0];
    console.log("🔍 [DEBUG] ReportsController.create - Usuario:", user ? user.email : 'Anónimo');
    console.log("🔍 DTO Recibido:", JSON.stringify(dto, null, 2));
    return this.reportsService.create(dto, photo, audio, user);
  }

  // GET /reports?estadoId=...&skip=0 — Todos los autenticados o Invitados
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard, RolesGuard)
  findAll(
    @Query('skip') skip?: string,
    @Query('estadoId') estadoId?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.reportsService.findAll(
      skip ? parseInt(skip, 10) : 0,
      estadoId,
      user?.rol,
    );
  }

  // GET /reports/mine — Solo REPORTANTE: sus propios reportes
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('REPORTANTE')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.reportsService.findMine(user.sub);
  }

  /**
   * GET /reports/prioritized
   * Devuelve los reportes ordenados por el Índice de Riesgo Dinámico.
   */
  @Get('prioritized')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  getPrioritized(@Query('skip') skip?: string) {
    return this.reportsService.getPrioritized(skip ? parseInt(skip, 10) : 0);
  }

  /**
   * GET /reports/ranking
   * Devuelve el ranking de ciudadanos por puntos.
   */
  @Get('ranking')
  @UseGuards(JwtAuthGuard)
  getRanking() {
    return this.reportsService.getRankingCiudadano();
  }

  /**
   * GET /reports/suggest-category
   * Sugiere categoría/prioridad (keywords + LLM + fallback).
   */
  @Get('suggest-category')
  @Public()
  suggestCategory(@Query('text') text: string) {
    return this.reportsService.sugerirCategoria(text || '');
  }

  /**
   * GET /reports/stats
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  getStats() {
    return this.reportsService.getStats();
  }

  /**
   * GET /reports/analytics?from=&to=
   * KPIs, tiempos de atención (historial), desglose categoría/zona y ranking responsables.
   */
  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  getAnalytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getAnalytics(from, to);
  }

  /**
   * POST /reports/check-sla
   * Ejecuta manualmente el chequeo de SLA (también corre periódico en background).
   */
  @Post('check-sla')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CHECK_SLA')
  checkSla() {
    return this.slaMonitorService.verificarSla();
  }

  // GET /reports/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  /**
   * PATCH /reports/:id/status
   * Unificado: Maneja tanto actualizaciones simples (JSON/FormData sin archivo) 
   * como actualizaciones con evidencia (FormData con archivo).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_REPORT_STATUS')
  @UseInterceptors(FileInterceptor('fotoEvidencia', multerOptions))
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @UploadedFile() fotoEvidencia: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
    @Headers('content-type') contentType: string,
  ) {
    this.logger.debug(`[DEBUG] updateStatus - Content-Type: ${contentType}`);
    this.logger.debug(`[DEBUG] updateStatus - Body: ${JSON.stringify(dto)}`);
    this.logger.debug(`[DEBUG] updateStatus - Archivo: ${fotoEvidencia ? fotoEvidencia.originalname : 'Ninguno'}`);
    
    return this.reportsService.updateStatus(id, dto, fotoEvidencia, user);
  }

  /**
   * PATCH /reports/:id/validar
   * Validación ciudadana de la solución.
   */
  @Patch(':id/validar')
  @UseGuards(JwtAuthGuard)
  @AuditAction('VALIDATE_REPORT_SOLUTION')
  validar(
    @Param('id') id: string,
    @Body('aprobado') aprobado: boolean,
    @Body('comentario') comentario?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.reportsService.validarSolucion(id, aprobado, comentario, user);
  }
}
