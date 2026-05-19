/*
  Warnings:

  - Made the column `estadoNuevoId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Made the column `categoriaId` on table `reportes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `estadoId` on table `reportes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prioridadId` on table `reportes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `reportes` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_estadoNuevoId_fkey";

-- DropForeignKey
ALTER TABLE "reportes" DROP CONSTRAINT "reportes_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "reportes" DROP CONSTRAINT "reportes_estadoId_fkey";

-- DropForeignKey
ALTER TABLE "reportes" DROP CONSTRAINT "reportes_prioridadId_fkey";

-- DropForeignKey
ALTER TABLE "reportes" DROP CONSTRAINT "reportes_reportanteId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "estadoNuevoId" SET NOT NULL;

-- AlterTable
ALTER TABLE "reportes" ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "transcripcionVoz" TEXT,
ADD COLUMN     "validadoCiudadano" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "reportanteId" DROP NOT NULL,
ALTER COLUMN "categoriaId" SET NOT NULL,
ALTER COLUMN "estadoId" SET NOT NULL,
ALTER COLUMN "prioridadId" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "pushToken" TEXT;

-- CreateTable
CREATE TABLE "puntos_ciudadanos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puntos_ciudadanos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "config_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "config_estados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_prioridadId_fkey" FOREIGN KEY ("prioridadId") REFERENCES "config_prioridades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportanteId_fkey" FOREIGN KEY ("reportanteId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntos_ciudadanos" ADD CONSTRAINT "puntos_ciudadanos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_estadoNuevoId_fkey" FOREIGN KEY ("estadoNuevoId") REFERENCES "config_estados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
