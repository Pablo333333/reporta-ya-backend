import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool as any) });

async function main() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE reportes ALTER COLUMN "validadoCiudadano" SET DEFAULT false',
  );
  await prisma.configSistema.updateMany({
    where: { clave: 'IA_CLASIFICACION_ENABLED' },
    data: {
      descripcion: 'Activa clasificación OpenAI (GPT) con fallback a keywords',
    },
  });
  console.log('OK: validadoCiudadano default=false + descripción IA actualizada');
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
