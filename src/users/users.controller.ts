import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SavePushTokenDto } from './dto/save-push-token.dto';
import { UsersService } from './users.service';
import { Rol } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SUPERVISOR')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('SUPERVISOR', 'RESPONSABLE')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * PATCH /users/push-token
   * Guarda el token de notificación push del dispositivo del usuario autenticado.
   * Cualquier rol puede llamar a este endpoint tras el login.
   */
  @Patch('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  savePushToken(
    @Body() dto: SavePushTokenDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.savePushToken(user.sub, dto.pushToken);
  }
}
