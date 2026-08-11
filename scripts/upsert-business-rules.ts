import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

const KEYS = [
  {
    clave: 'EVENTO_CRITICO_MIN_REPORTES',
    valor: '2',
    descripcion:
      'Cantidad mínima de reportes abiertos (misma zona+categoría) para marcar evento crítico',
  },
  {
    clave: 'EVENTO_CRITICO_VENTANA_HORAS',
    valor: '48',
    descripcion:
      'Ventana temporal (horas) para acumular reportes similares como evento crítico',
  },
  {
    clave: 'PUNTOS_CREAR_REPORTE',
    valor: '5',
    descripcion: 'Puntos otorgados al reportante al crear un reporte',
  },
  {
    clave: 'PUNTOS_VALIDAR_SOLUCION',
    valor: '15',
    descripcion: 'Puntos otorgados al confirmar (validar) una solución ciudadana',
  },
];

async function main() {
  for (const row of KEYS) {
    await prisma.configSistema.upsert({
      where: { clave: row.clave },
      update: { valor: row.valor, descripcion: row.descripcion },
      create: row,
    });
    console.log('OK', row.clave);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
