import { BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { Options as MulterOptions } from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

/** Tamaño máximo de archivo: 5 MB */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Tipos MIME aceptados */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

// Configuración de Cloudinary usando CLOUDINARY_URL
// El SDK de Cloudinary detecta automáticamente la variable de entorno CLOUDINARY_URL
cloudinary.config();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'reporta-ya',
    allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
    public_id: (_req, file) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      return `photo-${uniqueSuffix}`;
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
        `Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan: JPEG, PNG, WebP.`,
      ),
    );
  }
}

export const multerOptions: MulterOptions = {
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
};
