-- AlterTable
ALTER TABLE "comunicados" ADD COLUMN     "territorioId" TEXT;

-- AlterTable
ALTER TABLE "config_estados" ADD COLUMN     "requiereFoto" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
