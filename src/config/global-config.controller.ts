import { 
  Body, 
  Controller, 
  Delete,
  Get, 
  Param, 
  Patch, 
  Post, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { GlobalConfigService } from './global-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.configService.createCategoria(dto);
  }

  @Patch('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
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
  createCampoExtra(@Body() dto: CreateCampoExtraDto) {
    return this.configService.createCampoExtra(dto);
  }

  @Delete('campos-extra/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
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
  createEstado(@Body() data: any) {
    return this.configService.createEstado(data);
  }

  @Patch('estados/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
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
  createPrioridad(@Body() data: any) {
    return this.configService.createPrioridad(data);
  }

  @Patch('prioridades/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RESPONSABLE', 'SUPERVISOR')
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
  @Roles('SUPERVISOR')
  getLogs(
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
  ) {
    return this.configService.getLogs({ usuarioId, accion });
  }

  // ─── Roles y Permisos ──────────────────────────────────────────────────────

  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  getRoles() {
    return this.configService.getRoles();
  }

  @Get('permisos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  getPermisos() {
    return this.configService.getPermisos();
  }

  @Patch('roles/:id/permisos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERVISOR')
  updateRolPermisos(
    @Param('id') id: string,
    @Body('permisoIds') permisoIds: string[],
  ) {
    return this.configService.updateRolPermisos(id, permisoIds);
  }
}
