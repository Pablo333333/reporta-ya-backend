import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Patch, 
  Post, 
  UseGuards 
} from '@nestjs/common';
import { GlobalConfigService } from './global-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { CreateCategoriaDto, UpdateSistemaDto } from './dto/config.dto';

@Controller('config')
export class GlobalConfigController {
  constructor(private readonly configService: GlobalConfigService) {}

  // ─── Sistema ───────────────────────────────────────────────────────────────

  @Get('sistema')
  getSistema() {
    return this.configService.getSistema();
  }

  @Patch('sistema/:clave')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.RESPONSABLE, Rol.SUPERVISOR)
  updateSistema(
    @Param('clave') clave: string,
    @Body() dto: UpdateSistemaDto,
  ) {
    return this.configService.updateSistema(clave, dto.valor);
  }

  // ─── Categorías ────────────────────────────────────────────────────────────

  @Get('categorias')
  getCategorias() {
    return this.configService.getCategorias();
  }

  @Post('categorias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.RESPONSABLE, Rol.SUPERVISOR)
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.configService.createCategoria(dto);
  }

  @Patch('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.RESPONSABLE, Rol.SUPERVISOR)
  updateCategoria(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.configService.updateCategoria(id, data);
  }

  // ─── Estados ───────────────────────────────────────────────────────────────

  @Get('estados')
  getEstados() {
    return this.configService.getEstados();
  }

  // ─── Prioridades ───────────────────────────────────────────────────────────

  @Get('prioridades')
  getPrioridades() {
    return this.configService.getPrioridades();
  }
}
