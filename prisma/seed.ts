/**
 * Seed de base de datos — Reporta Ya
 * Optimizado para Prisma v7.5.0+ con Driver Adapter
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL no está definida en el entorno.');
  process.exit(1);
}

// Inicialización del cliente con el driver adapter requerido por Prisma v7 para DB locales
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// ─── Configuración Inicial del Sistema ─────────────────────────────────────────
const SEED_CONFIGS = [
  { clave: 'NOMBRE_APP', valor: 'Reporta Ya', descripcion: 'Nombre comercial de la plataforma' },
  { clave: 'SLOGAN', valor: 'Vigilancia Territorial Inteligente', descripcion: 'Slogan de la pantalla principal' },
  { clave: 'COLOR_PRIMARIO', valor: '#007AFF', descripcion: 'Color hexadecimal de la interfaz móvil' },
];

// ─── Estados de los Reportes (Flujo de Trabajo) ──────────────────────────────
const SEED_ESTADOS = [
  { nombre: 'Pendiente', color: '#FF3B30', esFinal: false, orden: 1 },
  { nombre: 'En Proceso', color: '#FFCC00', esFinal: false, orden: 2 },
  { nombre: 'Solucionado', color: '#34C759', esFinal: true, orden: 3 },
  { nombre: 'Reabierto', color: '#5856D6', esFinal: false, orden: 4 },
];

// ─── Prioridades de Gestión ──────────────────────────────────────────────────
const SEED_PRIORIDADES = [
  { nombre: 'Baja', color: '#8E8E93', nivel: 1 },
  { nombre: 'Media', color: '#FF9500', nivel: 2 },
  { nombre: 'Urgente', color: '#FF3B30', nivel: 3 },
];

// ─── Categorías Multitemáticas ──────────────────────────────────────────────
const SEED_CATEGORIAS = [
  { nombre: 'Piedras en la vía', descripcion: 'Obstrucción por desprendimiento de rocas', color: '#FF9500', icono: 'road' },
  { nombre: 'Derrumbe', descripcion: 'Deslizamiento de tierra masivo', color: '#FF3B30', icono: 'danger' },
  { nombre: 'Volquetes no dan pase', descripcion: 'Problemas de tránsito con maquinaria pesada', color: '#5AC8FA', icono: 'truck' },
  { nombre: 'Mucha pendiente', descripcion: 'Tramos viales peligrosos por excesiva inclinación', color: '#FFCC00', icono: 'trending' },
  { nombre: 'Contaminación de Río', descripcion: 'Vertido ilegal de sustancias en fuentes de agua', color: '#007AFF', icono: 'water' },
  { nombre: 'Generación de Polvo', descripcion: 'Impacto ambiental por tránsito pesado sin mitigación', color: '#A2845E', icono: 'alert' },
  { nombre: 'Residuos Sólidos', descripcion: 'Acumulación de basura o desmonte en zonas no autorizadas', color: '#4CD964', icono: 'trash-can' },
];

const SALT_ROUNDS = 12;

const SEED_USERS = [
  { email: 'test@reporte.com', password: '1234', rol: 'REPORTANTE' as const, label: 'REPORTANTE' },
  { email: 'test@responsable.com', password: '1234', rol: 'RESPONSABLE' as const, label: 'RESPONSABLE' },
  { email: 'test@supervisor.com', password: '1234', rol: 'SUPERVISOR' as const, label: 'SUPERVISOR' },
] as const;

async function main(): Promise<void> {
  console.log('\n🌱   Iniciando seed de Reporta Ya (Prisma v7 Driver Adapter Compliance)…\n');

  try {
    // 1. Cargar Configuración Global
    console.log('⚙️   Populando Configuración Global...');
    for (const config of SEED_CONFIGS) {
      await prisma.configSistema.upsert({
        where: { clave: config.clave },
        update: { valor: config.valor, descripcion: config.descripcion },
        create: config,
      });
    }
    console.log('    ✅ Parámetros globales listos.\n');

    // 2. Cargar Estados del Flujo
    console.log('🔄  Populando Estados del Flujo...');
    for (const estado of SEED_ESTADOS) {
      await prisma.configEstado.upsert({
        where: { nombre: estado.nombre },
        update: { color: estado.color, esFinal: estado.esFinal, orden: estado.orden },
        create: estado,
      });
    }
    console.log('    ✅ Estados operativos listos.\n');

    // 3. Cargar Prioridades
    console.log('⚠️   Populando Niveles de Prioridad...');
    for (const prioridad of SEED_PRIORIDADES) {
      await prisma.configPrioridad.upsert({
        where: { nombre: prioridad.nombre },
        update: { color: prioridad.color, nivel: prioridad.nivel },
        create: prioridad,
      });
    }
    console.log('    ✅ Niveles de urgencia listos.\n');

    // 4. Cargar Categorías
    console.log('📂   Populando Categorías...');
    for (const categoria of SEED_CATEGORIAS) {
      await prisma.configCategoria.upsert({
        where: { nombre: categoria.nombre },
        update: { descripcion: categoria.descripcion, color: categoria.color, icono: categoria.icono },
        create: categoria,
      });
    }
    console.log('    ✅ Matriz de categorías territorial lista.\n');

    // 5. Cargar Usuarios
    console.log('👤   Populando Usuarios de Prueba...');
    for (const userData of SEED_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

      const usuario = await prisma.usuario.upsert({
        where: { email: userData.email },
        update: {
          password: hashedPassword,
          rol: userData.rol,
        },
        create: {
          email: userData.email,
          password: hashedPassword,
          rol: userData.rol,
        },
      });

      console.log(
        `    ✅  ${userData.label.padEnd(12)} →  ${usuario.email}  (id: ${usuario.id})`,
      );
    }

    console.log('\n🎉   Seed completado exitosamente.\n');

  } catch (error) {
    console.error('\n❌   Error durante la ejecución del seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
