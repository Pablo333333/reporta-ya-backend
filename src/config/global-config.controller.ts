import { 
  Body, 
  Controller, 
  Delete,
  Get, 
  Param, 
  Patch, 
  Post, 
  Query,
  Headers,
  UseGuards 
} from '@nestjs/common';
import { GlobalConfigService } from './global-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuditAction } from '../common/decorators/audit.decorator';
import { Rol } from '@prisma/client';
import { CreateCampoExtraDto, CreateCategoriaDto, UpdateSistemaDto } from './dto/config.dto';

@Controller('config')
export class GlobalConfigController {
  constructor(private readonly configService: GlobalConfigService) {}

  // ─── Sistema ───────────────────────────────────────────────────────────────

  @Get('sistema')
  @Public()
  getSistema() {
    return this.configService.getSistema();
  }

  @Patch('sistema/:clave')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_SYSTEM_CONFIG')
  updateSistema(
    @Param('clave') clave: string,
    @Body() dto: UpdateSistemaDto,
  ) {
    return this.configService.updateSistema(clave, dto.valor);
  }

  // ─── Categorías ────────────────────────────────────────────────────────────

  @Get('categorias')
  @Public()
  getCategorias() {
    return this.configService.getCategorias();
  }

  @Post('categorias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CREATE_CATEGORY')
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.configService.createCategoria(dto);
  }

  @Patch('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_CATEGORY')
  updateCategoria(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.configService.updateCategoria(id, data);
  }

  // ─── Campos Extra ──────────────────────────────────────────────────────────

  @Post('campos-extra')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  @AuditAction('CREATE_EXTRA_FIELD')
  createCampoExtra(@Body() dto: CreateCampoExtraDto) {
    return this.configService.createCampoExtra(dto);
  }

  @Delete('campos-extra/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  @AuditAction('DELETE_EXTRA_FIELD')
  deleteCampoExtra(@Param('id') id: string) {
    return this.configService.deleteCampoExtra(id);
  }

  // ─── Estados ───────────────────────────────────────────────────────────────

  @Get('estados')
  @Public()
  getEstados() {
    return this.configService.getEstados();
  }

  @Post('estados')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CREATE_STATUS')
  createEstado(@Body() data: any) {
    return this.configService.createEstado(data);
  }

  @Patch('estados/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_STATUS_CONFIG')
  updateEstado(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.configService.updateEstado(id, data);
  }

  // ─── Prioridades ───────────────────────────────────────────────────────────

  @Get('prioridades')
  @Public()
  getPrioridades() {
    return this.configService.getPrioridades();
  }

  @Post('prioridades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CREATE_PRIORITY')
  createPrioridad(@Body() data: any) {
    return this.configService.createPrioridad(data);
  }

  @Patch('prioridades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_PRIORITY')
  updatePrioridad(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.configService.updatePrioridad(id, data);
  }

  @Get('territorios')
  @Public()
  getTerritorios() {
    return this.configService.getTerritorios();
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR', 'RESPONSABLE')
  getLogs(
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
    @Headers() headers?: any,
  ) {
    const territorioId = headers?.['x-territorio-id'];
    console.log('[DEBUG] GlobalConfigController.getLogs - Query Params:', { usuarioId, accion });
    console.log('[DEBUG] GlobalConfigController.getLogs - Headers:', { 
      'x-territorio-id': territorioId,
      'authorization': headers?.['authorization'] ? 'Presente' : 'Ausente'
    });
    return this.configService.getLogs({ usuarioId, accion, territorioId });
  }

  // ─── Roles y Permisos ──────────────────────────────────────────────────────

  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR', 'RESPONSABLE')
  getRoles() {
    return this.configService.getRoles();
  }

  @Get('permisos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR', 'RESPONSABLE')
  getPermisos() {
    return this.configService.getPermisos();
  }

  @Patch('roles/:id/permisos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  @AuditAction('UPDATE_ROLE_PERMISSIONS')
  updateRolPermisos(
    @Param('id') id: string,
    @Body('permisoIds') permisoIds: string[],
  ) {
    return this.configService.updateRolPermisos(id, permisoIds);
  }

  // ─── Mensajes automáticos ──────────────────────────────────────────────────

  @Get('mensajes-auto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  getMensajesAuto() {
    return this.configService.getMensajesAuto();
  }

  @Post('mensajes-auto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('CREATE_AUTO_MESSAGE')
  createMensajeAuto(@Body() data: any) {
    return this.configService.createMensajeAuto(data);
  }

  @Patch('mensajes-auto/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
  @AuditAction('UPDATE_AUTO_MESSAGE')
  updateMensajeAuto(@Param('id') id: string, @Body() data: any) {
    return this.configService.updateMensajeAuto(id, data);
  }

  @Delete('mensajes-auto/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  @AuditAction('DELETE_AUTO_MESSAGE')
  deleteMensajeAuto(@Param('id') id: string) {
    return this.configService.deleteMensajeAuto(id);
  }
}
