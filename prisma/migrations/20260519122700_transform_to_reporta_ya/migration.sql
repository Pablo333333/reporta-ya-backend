-- Transformación de Vigilancia de la Vía a Reporta Ya
-- Fecha: 2026-05-19

-- CreateTable: config_sistema
CREATE TABLE "config_sistema" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable: config_categorias
CREATE TABLE "config_categorias" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT DEFAULT '#000000',
    "icono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable: config_estados
CREATE TABLE "config_estados" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT DEFAULT '#000000',
    "esFinal" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable: config_prioridades
CREATE TABLE "config_prioridades" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT DEFAULT '#000000',
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_prioridades_pkey" PRIMARY KEY ("id")
);

-- CreateTable: logs_acciones
CREATE TABLE "logs_acciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalles" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_acciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs (Si no existía en la migración previa)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_sistema_clave_key" ON "config_sistema"("clave");
CREATE UNIQUE INDEX "config_categorias_nombre_key" ON "config_categorias"("nombre");
CREATE UNIQUE INDEX "config_estados_nombre_key" ON "config_estados"("nombre");
CREATE UNIQUE INDEX "config_prioridades_nombre_key" ON "config_prioridades"("nombre");

-- AlterTable: reportes (Agregar nuevas columnas y preparar para FKs)
ALTER TABLE "reportes" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "reportes" ADD COLUMN "estadoId" TEXT;
ALTER TABLE "reportes" ADD COLUMN "prioridadId" TEXT;
ALTER TABLE "reportes" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "reportes" ADD COLUMN "comentarioResolucion" TEXT;
ALTER TABLE "reportes" ADD COLUMN "fotoEvidenciaUrl" TEXT;
ALTER TABLE "reportes" ADD COLUMN "sincronizadoEn" TIMESTAMP(3);
ALTER TABLE "reportes" ADD COLUMN "zona" TEXT;

-- AlterTable: audit_logs (Agregar nuevas columnas para FKs)
ALTER TABLE "audit_logs" ADD COLUMN "estadoAnteriorId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "estadoNuevoId" TEXT;

-- AddForeignKey: logs_acciones
ALTER TABLE "logs_acciones" ADD CONSTRAINT "logs_acciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: reportes
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "config_categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "config_estados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_prioridadId_fkey" FOREIGN KEY ("prioridadId") REFERENCES "config_prioridades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: audit_logs
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "reportes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_estadoAnteriorId_fkey" FOREIGN KEY ("estadoAnteriorId") REFERENCES "config_estados"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_estadoNuevoId_fkey" FOREIGN KEY ("estadoNuevoId") REFERENCES "config_estados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old columns and enums
-- Nota: En un entorno real, se debería migrar la data antes de borrar las columnas.
ALTER TABLE "reportes" DROP COLUMN "tipoProblema";
ALTER TABLE "reportes" DROP COLUMN "estado";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "estadoAnterior";
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "estadoNuevo";

DROP TYPE IF EXISTS "TipoProblema";
DROP TYPE IF EXISTS "EstadoReporte";
