import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
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

@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);
  constructor(private readonly reportsService: ReportsService) {}

  // POST /reports — Usuarios autenticados (REPORTANTE, RESPONSABLE, SUPERVISOR) o Invitados (Anónimos)
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
    return this.reportsService.create(dto, photo, audio, user);
  }

  // GET /reports?estadoId=...&skip=0 — Todos los autenticados; REPORTANTE no ve SOLUCIONADO
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
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
   * Sugiere una categoría basada en el texto descriptivo.
   */
  @Get('suggest-category')
  suggestCategory(@Query('text') text: string) {
    return this.reportsService.sugerirCategoria(text);
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

  // GET /reports/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  /**
   * PATCH /reports/:id/status
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
  ) {
    this.logger.debug(`[DEBUG] updateStatus - Payload recibido: ${JSON.stringify(dto)}`);
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
