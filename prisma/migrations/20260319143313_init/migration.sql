-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('REPORTANTE', 'RESPONSABLE', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "TipoProblema" AS ENUM ('PIEDRAS', 'DERRUMBE', 'BACHE', 'INUNDACION', 'ACCIDENTE', 'OBSTRUCCION', 'DESLIZAMIENTO', 'ARBOL_CAIDO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'SOLUCIONADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'REPORTANTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes" (
    "id" TEXT NOT NULL,
    "tipoProblema" "TipoProblema" NOT NULL,
    "comentario" TEXT,
    "fotoUrl" TEXT,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "reportanteId" TEXT NOT NULL,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicados" (
    "id" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duracionRestriccion" INTEGER,
    "responsableId" TEXT NOT NULL,

    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_reportanteId_fkey" FOREIGN KEY ("reportanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
