import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { Options as MulterOptions } from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

/** Tamaño máximo de archivo: 5 MB */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Tipos MIME aceptados: Imágenes y Audio móvil */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'audio/mp4',
  'audio/mp4a',
  'audio/m4a',
  'audio/mpeg',
  'audio/x-m4a',
  'audio/3gp',
  'audio/3gpp',
  'audio/wav',
  'audio/x-wav',
  'application/octet-stream',
];

// Configuración de Cloudinary parseando la URL completa
// Configuración nativa y limpia de Cloudinary
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  console.warn("⚠️ ALERTA: No se encontró la variable CLOUDINARY_URL en el entorno.");
}

// El SDK de Cloudinary levanta process.env.CLOUDINARY_URL automáticamente sin parsear nada
cloudinary.config();
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'reporta-ya',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'png', 'webp', 'jpeg', 'm4a', 'mp4', 'mp3', 'wav'],
    public_id: (_req, file) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const prefix = file.fieldname === 'audio' ? 'audio' : 'photo';
      return `${prefix}-${uniqueSuffix}`;
    },
  } as any,
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: any,
): void {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan: PNG, JPEG, WebP y Audio (MP4, M4A, MPEG).`,
      ),
    );
  }
}

export const multerOptions: MulterOptions = {
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
