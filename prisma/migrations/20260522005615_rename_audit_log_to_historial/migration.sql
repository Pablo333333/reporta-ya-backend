/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_estadoAnteriorId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_estadoNuevoId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_reporteId_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_usuarioId_fkey";

-- DropTable
DROP TABLE "audit_logs";

-- CreateTable
CREATE TABLE "historial_reportes" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "estadoAnteriorId" TEXT,
    "estadoNuevoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comentario" TEXT,

    CONSTRAINT "historial_reportes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "historial_reportes" ADD CONSTRAINT "historial_reportes_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "reportes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reportes" ADD CONSTRAINT "historial_reportes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reportes" ADD CONSTRAINT "historial_reportes_estadoAnteriorId_fkey" FOREIGN KEY ("estadoAnteriorId") REFERENCES "config_estados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_reportes" ADD CONSTRAINT "historial_reportes_estadoNuevoId_fkey" FOREIGN KEY ("estadoNuevoId") REFERENCES "config_estados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
