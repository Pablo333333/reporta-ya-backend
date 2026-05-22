import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool!: pg.Pool;
  private client!: any; // Usamos any para permitir el cliente extendido

  get usuario() { return this.client.usuario; }
  get territorio() { return this.client.territorio; }
  get reporte() { return this.client.reporte; }
  get comunicado() { return this.client.comunicado; }
  get auditLog() { return this.client.auditLog; }
  get configSistema() { return this.client.configSistema; }
  get configCategoria() { return this.client.configCategoria; }
  get configEstado() { return this.client.configEstado; }
  get configPrioridad() { return this.client.configPrioridad; }
  get logAccion() { return this.client.logAccion; }
  get puntosCiudadanos() { return this.client.puntosCiudadanos; }

  async onModuleInit(): Promise<void> {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida en las variables de entorno');
    }

    this.logger.log(`Conectando a PostgreSQL (host: ${new URL(connectionString).host})…`);

    this.pool = new pg.Pool({ connectionString });

    const testClient = await this.pool.connect();
    testClient.release();
    this.logger.log('Conexión a PostgreSQL verificada');

    const adapter = new PrismaPg(this.pool as any);
    const baseClient = new PrismaClient({ adapter });
    
    // Aplicamos la extensión de Multi-tenancy
    this.client = baseClient.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const territorioId = TenantContext.territorioId;
            
            // Si hay un territorioId en el contexto, lo aplicamos a las consultas
            // Solo si el modelo tiene el campo territorioId (según schema.prisma)
            const modelsWithTenant = [
              'Usuario', 'Reporte', 'Comunicado', 'ConfigSistema', 
              'ConfigCategoria', 'ConfigEstado', 'ConfigPrioridad'
            ];

            if (territorioId && modelsWithTenant.includes(model)) {
              if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                args.where = { ...args.where, territorioId };
              } else if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(operation)) {
                args.where = { ...args.where, territorioId };
              } else if (['create', 'createMany'].includes(operation)) {
                if (operation === 'create') {
                  args.data = { ...args.data, territorioId };
                } else {
                  if (Array.isArray(args.data)) {
                    args.data = args.data.map(item => ({ ...item, territorioId }));
                  }
                }
              }
            }
            return query(args);
          },
        },
      },
    });

    await baseClient.$connect();

    const userCount = await this.client.usuario.count();
    this.logger.log(`Usuarios en la base de datos: ${userCount}`);
    if (userCount === 0) {
      this.logger.warn('⚠ La tabla "usuarios" está vacía — ejecutá: npx prisma db seed');
    } else {
      const emails = await this.client.usuario.findMany({ select: { email: true, rol: true } });
      this.logger.log(`Usuarios registrados: ${emails.map(u => `${u.email} (${u.rol})`).join(', ')}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
    await this.pool?.end();
  }
}
