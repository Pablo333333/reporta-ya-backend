import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, params } = request;

    // Solo auditamos métodos que modifican datos (POST, PATCH, DELETE)
    const methodsToAudit = ['POST', 'PATCH', 'DELETE'];
    if (!methodsToAudit.includes(method)) {
      return next.handle();
    }

    // Intentamos obtener una acción descriptiva del decorador @AuditAction
    const auditAction = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    
    // Si no hay decorador, generamos una acción genérica basada en el método y la URL
    const action = auditAction || `${method} ${url.split('?')[0]}`;

    return next.handle().pipe(
      tap({
        next: async (data) => {
          try {
            // Extraemos la entidad y el ID de la URL o del cuerpo
            const urlParts = url.split('/').filter(Boolean);
            const entidad = urlParts[0] || 'unknown';
            const entidadId = params.id || data?.id || body?.id || 'N/A';

            await this.prisma.logAccion.create({
              data: {
                usuarioId: user?.sub || user?.id || null,
                accion: action,
                entidad: entidad.toUpperCase(),
                entidadId: String(entidadId),
                detalles: {
                  method,
                  url,
                  body: this.sanitizeBody(body),
                  // No guardamos la respuesta completa para no saturar la DB, 
                  // pero podrías guardar campos clave si fuera necesario.
                },
              },
            });
            this.logger.log(`Audit log creado: ${action} por usuario ${user?.sub || 'Anónimo'}`);
          } catch (error) {
            this.logger.error('Error al crear audit log:', error);
          }
        },
      }),
    );
  }

  private sanitizeBody(body: any) {
    if (!body) return null;
    const sanitized = { ...body };
    // Ocultar información sensible
    const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) sanitized[field] = '********';
    });
    return sanitized;
  }
}
