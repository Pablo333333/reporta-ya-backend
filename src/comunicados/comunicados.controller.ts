import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ComunicadosService } from './comunicados.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('comunicados')
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  // POST /comunicados — Solo RESPONSABLE (SUPERVISOR es solo lectura)
  @Post()
  @Roles('RESPONSABLE')
  create(
    @Body() dto: CreateComunicadoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.comunicadosService.create(dto, user);
  }

  // GET /comunicados — Todos los usuarios autenticados
  @Get()
  findAll() {
    return this.comunicadosService.findAll();
  }

  // GET /comunicados/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }
}
