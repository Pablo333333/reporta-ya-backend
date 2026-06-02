import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificando Tabla LogAccion ---');
  try {
    const totalLogs = await prisma.logAccion.count();
    console.log(`Total de registros en LogAccion: ${totalLogs}`);

    if (totalLogs > 0) {
      const sampleLogs = await prisma.logAccion.findMany({
        take: 5,
        include: { usuario: { select: { email: true, territorioId: true } } },
        orderBy: { fecha: 'desc' }
      });
      console.log('Muestra de los últimos 5 logs:');
      console.dir(sampleLogs, { depth: null });
    } else {
      console.log('La tabla está completamente vacía.');
    }
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
