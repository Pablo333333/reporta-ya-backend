/*
  Warnings:

  - You are about to drop the column `rol` on the `usuarios` table. All the data in the column will be lost.
  - Added the required column `rolId` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "rolId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_nombre_key" ON "permisos"("nombre");

-- Insert default roles to avoid null constraint violation
INSERT INTO "roles" ("id", "nombre", "descripcion") VALUES (gen_random_uuid(), 'REPORTANTE', 'Ciudadano que reporta incidentes');
INSERT INTO "roles" ("id", "nombre", "descripcion") VALUES (gen_random_uuid(), 'RESPONSABLE', 'Operador técnico que resuelve incidentes');
INSERT INTO "roles" ("id", "nombre", "descripcion") VALUES (gen_random_uuid(), 'SUPERVISOR', 'Administrador total del sistema');

-- AlterTable: Add rolId as nullable first
ALTER TABLE "usuarios" ADD COLUMN "rolId" TEXT;

-- Data Migration: Map old 'rol' enum values to new 'roles' table IDs
UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "nombre" = 'REPORTANTE') WHERE "rol"::text = 'REPORTANTE';
UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "nombre" = 'RESPONSABLE') WHERE "rol"::text = 'RESPONSABLE';
UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "nombre" = 'SUPERVISOR') WHERE "rol"::text = 'SUPERVISOR';

-- Fallback for any user without a role
UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "nombre" = 'REPORTANTE') WHERE "rolId" IS NULL;

-- AlterTable: Now set rolId to NOT NULL
ALTER TABLE "usuarios" ALTER COLUMN "rolId" SET NOT NULL;

-- AlterTable: Drop old column
ALTER TABLE "usuarios" DROP COLUMN "rol";

-- DropEnum
DROP TYPE "Rol";

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
