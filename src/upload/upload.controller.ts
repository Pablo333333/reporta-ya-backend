import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { multerOptions } from './upload.config';
import { UploadService } from './upload.service';

export interface UploadPhotoResponse {
  url: string;
  filename: string;
}

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/photo
   *
   * Recibe un archivo en el campo "photo" (multipart/form-data).
   * Cloudinary lo guarda y devuelve la URL.
   *
   * Ejemplo de respuesta:
   * {
   *   "url": "https://res.cloudinary.com/demo/image/upload/v123456789/reporta-ya/photo-1710000000000-123456.jpg",
   *   "filename": "reporta-ya/photo-1710000000000-123456"
   * }
   */
  @Post('photo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('photo', multerOptions))
  uploadPhoto(
    @UploadedFile() file: any,
  ): UploadPhotoResponse {
    // Con CloudinaryStorage, file.path contiene la URL segura y file.filename el public_id
    return { url: file.path, filename: file.filename };
  }
}
