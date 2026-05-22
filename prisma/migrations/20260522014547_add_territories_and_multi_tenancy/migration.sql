-- AlterTable
ALTER TABLE "config_categorias" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "config_estados" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "config_prioridades" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "config_sistema" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "reportes" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "territorioId" TEXT;

-- CreateTable
CREATE TABLE "territorios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "configuracionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "territorios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "territorios_nombre_key" ON "territorios"("nombre");

-- AddForeignKey
ALTER TABLE "config_sistema" ADD CONSTRAINT "config_sistema_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_categorias" ADD CONSTRAINT "config_categorias_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_estados" ADD CONSTRAINT "config_estados_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_prioridades" ADD CONSTRAINT "config_prioridades_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
