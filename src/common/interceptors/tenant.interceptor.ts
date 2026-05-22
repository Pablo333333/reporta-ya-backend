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
    
    // El territorioId puede venir del usuario (JWT) o de un header (para demos/superadmins)
    const headerTerritorioId = request.headers['x-territorio-id'];
    const territorioId = headerTerritorioId || user?.territorioId || null;

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
