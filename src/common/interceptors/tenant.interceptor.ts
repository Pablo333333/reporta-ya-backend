import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const url = request.url;
    
    // El territorioId puede venir del usuario (JWT) o de un header (para demos/superadmins)
    const headerTerritorioId = request.headers['x-territorio-id'];
    
    // Fallback robusto: Prioridad Header > Usuario > Territorio '1' (Default para rutas públicas)
    const territorioId = headerTerritorioId || user?.territorioId || '1';

    console.log(`[DEBUG] TenantInterceptor - URL: ${url}`);
    console.log(`[DEBUG] TenantInterceptor - User: ${user ? user.email : 'Guest/Undefined'}`);
    console.log(`[DEBUG] TenantInterceptor - Final territorioId: ${territorioId}`);

    return new Observable((observer) => {
      TenantContext.run(territorioId, () => {
        next.handle().subscribe({
          next: (res) => observer.next(res),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
