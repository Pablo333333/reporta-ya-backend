import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no se requiere ni rol ni permiso, permitimos el paso (asumiendo que JwtAuthGuard ya validó la autenticación)
    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<any>();
    const userPayload = request.user;

    if (!userPayload) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Buscamos el usuario en la DB con su rol y permisos
    const user = await this.prisma.usuario.findUnique({
      where: { id: userPayload.sub },
      include: {
        rol: {
          include: {
            permisos: {
              include: {
                permiso: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const userRoleName = user.rol.nombre;
    const userPermissions = user.rol.permisos.map(rp => rp.permiso.nombre);

    console.log(`[DEBUG] RolesGuard - userRoleName: ${userRoleName}`);
    console.log(`[DEBUG] RolesGuard - requiredRoles: ${requiredRoles}`);

    // 0. Validación de Territorio (Multi-Tenancy)
    const territorioIdHeader = request.headers['x-territorio-id'] as string;
    console.log(`[DEBUG] RolesGuard - territorioIdHeader: ${territorioIdHeader}`);
    console.log(`[DEBUG] RolesGuard - user.territorioId: ${user.territorioId}`);

    if (territorioIdHeader && user.territorioId && user.territorioId !== territorioIdHeader) {
      console.log(`[DEBUG] RolesGuard - Forbidden: Territorio mismatch`);
      throw new ForbiddenException('No tienes acceso a este territorio');
    }

    // 1. Verificar Roles (si existen requeridos)
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.includes(userRoleName);
      if (hasRole) return true;
    }

    // 2. Verificar Permisos (si existen requeridos)
    if (requiredPermissions?.length) {
      const hasPermission = requiredPermissions.every(p => userPermissions.includes(p));
      if (hasPermission) return true;
    }

    throw new ForbiddenException('No tienes los permisos necesarios para realizar esta acción');
  }
}
