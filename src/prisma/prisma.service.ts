import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool!: pg.Pool;
  private client!: PrismaClient;

  get usuario() { return this.client.usuario; }
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
    this.client = new PrismaClient({ adapter });
    await this.client.$connect();

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
