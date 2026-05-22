-- AlterTable
ALTER TABLE "reportes" ADD COLUMN     "valoresCamposExtra" JSONB;

-- CreateTable
CREATE TABLE "config_campos_extra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "requerido" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT NOT NULL,

    CONSTRAINT "config_campos_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprendizaje_ia" (
    "id" TEXT NOT NULL,
    "textoReporte" TEXT NOT NULL,
    "categoriaSugerida" TEXT NOT NULL,
    "categoriaReal" TEXT NOT NULL,
    "corregido" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprendizaje_ia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "config_campos_extra" ADD CONSTRAINT "config_campos_extra_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "config_categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
