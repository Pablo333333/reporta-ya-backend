/**
 * Seed de base de datos — Reporta Ya
 * Optimizado para Prisma v7.5.0+ con RBAC Dinámico
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

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

const SEED_CONFIGS = [
  { clave: 'NOMBRE_APP', valor: 'Reporta Ya', descripcion: 'Nombre comercial de la plataforma' },
  { clave: 'SLOGAN', valor: 'Vigilancia Territorial Inteligente', descripcion: 'Slogan de la pantalla principal' },
  { clave: 'COLOR_PRIMARIO', valor: '#007AFF', descripcion: 'Color hexadecimal de la interfaz móvil' },
  { clave: 'PESO_GRAVEDAD', valor: '0.6', descripcion: 'Peso de la gravedad en la fórmula de riesgo (0-1)' },
  { clave: 'PESO_FRECUENCIA', valor: '0.4', descripcion: 'Peso de la frecuencia en la fórmula de riesgo (0-1)' },
  { clave: 'IA_CLASIFICACION_ENABLED', valor: 'true', descripcion: 'Activa clasificación OpenAI (GPT) con fallback a keywords' },
  // Reglas de negocio: eventos críticos y gamificación
  { clave: 'EVENTO_CRITICO_MIN_REPORTES', valor: '2', descripcion: 'Cantidad mínima de reportes abiertos (misma zona+categoría) para marcar evento crítico' },
  { clave: 'EVENTO_CRITICO_VENTANA_HORAS', valor: '48', descripcion: 'Ventana temporal (horas) para acumular reportes similares como evento crítico' },
  { clave: 'PUNTOS_CREAR_REPORTE', valor: '5', descripcion: 'Puntos otorgados al reportante al crear un reporte' },
  { clave: 'PUNTOS_VALIDAR_SOLUCION', valor: '15', descripcion: 'Puntos otorgados al confirmar (validar) una solución ciudadana' },
  { clave: 'SLA_HORAS_LIMITE', valor: '48', descripcion: 'Horas máximas sin resolución antes de marcar SLA incumplido' },
];

const SEED_MENSAJES_AUTO = [
  {
    tipo: 'NUEVO_REPORTE',
    plantilla: 'Nuevo reporte: {{categoria}}. Revisá el mapa.',
    descripcion: 'Push a responsables al crear un reporte',
  },
  {
    tipo: 'EVENTO_CRITICO',
    plantilla: '🚨 EVENTO CRÍTICO en zona {{zona}} ({{categoria}}). Intervención prioritaria.',
    descripcion: 'Alerta por acumulación de reportes similares',
  },
  {
    tipo: 'PRIORIDAD_ALTA',
    plantilla: '⚠️ Reporte urgente en zona {{zona}}: {{categoria}}.',
    descripcion: 'Alerta por prioridad alta',
  },
  {
    tipo: 'COMUNICADO',
    plantilla: '📢 Comunicado{{zonaSuffix}}: {{mensaje}}',
    descripcion: 'Push masivo al publicar un comunicado',
  },
  {
    tipo: 'VALIDACION_CIUDADANA',
    plantilla: 'Tu reporte sobre "{{categoria}}" fue marcado como solucionado. Confirmá o reabrí en Mis Reportes.',
    descripcion: 'Invitación a validar solución',
  },
  {
    tipo: 'SLA_INCUMPLIDO',
    plantilla: '⏱ SLA incumplido: reporte {{categoria}} en {{zona}} lleva más de {{horas}}h sin resolución.',
    descripcion: 'Alerta a responsables por vencimiento de SLA',
  },
];

const SEED_ESTADOS = [
  { nombre: 'Pendiente', color: '#FF3B30', esFinal: false, orden: 1 },
  { nombre: 'En Proceso', color: '#FFCC00', esFinal: false, orden: 2 },
  { nombre: 'Solucionado', color: '#34C759', esFinal: true, orden: 3 },
  { nombre: 'Reabierto', color: '#5856D6', esFinal: false, orden: 4 },
];

const SEED_PRIORIDADES = [
  { nombre: 'Baja', color: '#8E8E93', nivel: 1 },
  { nombre: 'Media', color: '#FF9500', nivel: 2 },
  { nombre: 'Urgente', color: '#FF3B30', nivel: 3 },
];

const SEED_CATEGORIAS = [
  { nombre: 'Piedras en la vía', descripcion: 'Obstrucción por desprendimiento de rocas', color: '#FF9500', icono: 'road' },
  { nombre: 'Derrumbe', descripcion: 'Deslizamiento de tierra masivo', color: '#FF3B30', icono: 'danger' },
  { nombre: 'Volquetes no dan pase', descripcion: 'Problemas de tránsito con maquinaria pesada', color: '#5AC8FA', icono: 'truck' },
  { nombre: 'Mucha pendiente', descripcion: 'Tramos viales peligrosos por excesiva inclinación', color: '#FFCC00', icono: 'trending' },
  { nombre: 'Contaminación de Río', descripcion: 'Vertido ilegal de sustancias en fuentes de agua', color: '#007AFF', icono: 'water' },
  { nombre: 'Generación de Polvo', descripcion: 'Impacto ambiental por tránsito pesado sin mitigación', color: '#A2845E', icono: 'alert' },
  { nombre: 'Residuos Sólidos', descripcion: 'Acumulación de basura o desmonte en zonas no autorizadas', color: '#4CD964', icono: 'trash-can' },
];

const SEED_PERMISOS = [
  { nombre: 'can_view_reports', descripcion: 'Ver reportes' },
  { nombre: 'can_create_reports', descripcion: 'Crear reportes' },
  { nombre: 'can_edit_reports', descripcion: 'Editar estado de reportes' },
  { nombre: 'can_manage_users', descripcion: 'Gestionar usuarios y roles' },
  { nombre: 'can_manage_config', descripcion: 'Gestionar configuración del sistema' },
];

const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  console.log('\n🌱   Iniciando seed de Reporta Ya (RBAC Dinámico)…\n');

  try {
    // 0. Territorio de Prueba
    const territorio = await prisma.territorio.upsert({
      where: { id: '1' },
      update: { nombre: 'Territorio de Prueba' },
      create: { id: '1', nombre: 'Territorio de Prueba', descripcion: 'Territorio inicial para desarrollo' },
    });

    // 1. Configuración Global
    for (const config of SEED_CONFIGS) {
      await prisma.configSistema.upsert({
        where: { clave: config.clave },
        update: { valor: config.valor, descripcion: config.descripcion, territorioId: territorio.id },
        create: { ...config, territorioId: territorio.id },
      });
    }

    // 1b. Plantillas de mensajes automáticos
    for (const msg of SEED_MENSAJES_AUTO) {
      const existing = await prisma.configMensajeAuto.findFirst({
        where: { tipo: msg.tipo, territorioId: territorio.id },
      });
      if (existing) {
        await prisma.configMensajeAuto.update({
          where: { id: existing.id },
          data: {
            plantilla: msg.plantilla,
            descripcion: msg.descripcion,
            activo: true,
          },
        });
      } else {
        await prisma.configMensajeAuto.create({
          data: { ...msg, activo: true, territorioId: territorio.id },
        });
      }
    }

    // 2. Estados
    for (const estado of SEED_ESTADOS) {
      await prisma.configEstado.upsert({
        where: { nombre: estado.nombre },
        update: { color: estado.color, esFinal: estado.esFinal, orden: estado.orden, territorioId: territorio.id },
        create: { ...estado, territorioId: territorio.id },
      });
    }

    // 3. Prioridades
    for (const prioridad of SEED_PRIORIDADES) {
      await prisma.configPrioridad.upsert({
        where: { nombre: prioridad.nombre },
        update: { color: prioridad.color, nivel: prioridad.nivel, territorioId: territorio.id },
        create: { ...prioridad, territorioId: territorio.id },
      });
    }

    // 4. Categorías
    for (const categoria of SEED_CATEGORIAS) {
      await prisma.configCategoria.upsert({
        where: { nombre: categoria.nombre },
        update: { descripcion: categoria.descripcion, color: categoria.color, icono: categoria.icono, territorioId: territorio.id },
        create: { ...categoria, territorioId: territorio.id },
      });
    }

    // 5. Permisos
    const permisosCreados: Record<string, any> = {};
    for (const p of SEED_PERMISOS) {
      permisosCreados[p.nombre] = await prisma.permiso.upsert({
        where: { nombre: p.nombre },
        update: { descripcion: p.descripcion },
        create: p,
      });
    }

    // 6. Roles y Relaciones
    const roles = [
      { 
        nombre: 'REPORTANTE', 
        descripcion: 'Ciudadano que reporta incidentes',
        permisos: ['can_view_reports', 'can_create_reports']
      },
      { 
        nombre: 'RESPONSABLE', 
        descripcion: 'Operador técnico que resuelve incidentes',
        permisos: ['can_view_reports', 'can_edit_reports']
      },
      { 
        nombre: 'SUPERVISOR', 
        descripcion: 'Administrador total del sistema',
        permisos: SEED_PERMISOS.map(p => p.nombre)
      },
    ];

    for (const r of roles) {
      const rol = await prisma.rol.upsert({
        where: { nombre: r.nombre },
        update: { descripcion: r.descripcion },
        create: { nombre: r.nombre, descripcion: r.descripcion },
      });

      // Asignar permisos al rol
      for (const pNombre of r.permisos) {
        await prisma.rolPermiso.upsert({
          where: {
            rolId_permisoId: {
              rolId: rol.id,
              permisoId: permisosCreados[pNombre].id,
            },
          },
          update: {},
          create: {
            rolId: rol.id,
            permisoId: permisosCreados[pNombre].id,
          },
        });
      }
    }

    // 7. Usuarios de Prueba
    const users = [
      { email: 'test@reporte.com', password: '1234', rol: 'REPORTANTE' },
      { email: 'test@responsable.com', password: '1234', rol: 'RESPONSABLE' },
      { email: 'test@supervisor.com', password: '1234', rol: 'SUPERVISOR' },
    ];

    for (const u of users) {
      const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);
      const rol = await prisma.rol.findUnique({ where: { nombre: u.rol } });
      
      await prisma.usuario.upsert({
        where: { email: u.email },
        update: { password: hashedPassword, rolId: rol!.id, territorioId: territorio.id },
        create: { email: u.email, password: hashedPassword, rolId: rol!.id, territorioId: territorio.id },
      });
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
