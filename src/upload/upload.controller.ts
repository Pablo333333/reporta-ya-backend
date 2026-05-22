import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { multerOptions } from './upload.config';
import { UploadService } from './upload.service';

export interface UploadResponse {
  url: string;
  filename: string;
  photo?: { url: string; filename: string };
  audio?: { url: string; filename: string };
}

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload/photo
   *
   * Recibe archivos en los campos "photo" y/o "audio" (multipart/form-data).
   * Cloudinary los guarda y devuelve las URLs.
   */
  @Post('photo')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      multerOptions,
    ),
  )
  uploadFiles(
    @UploadedFiles() files: { photo?: any[]; audio?: any[] },
  ): UploadResponse {
    const response: any = {};

    const photo = files?.photo?.[0];
    const audio = files?.audio?.[0];

    if (photo) {
      response.photo = { url: photo.path, filename: photo.filename };
      // Compatibilidad con la interfaz anterior
      response.url = photo.path;
      response.filename = photo.filename;
    }

    if (audio) {
      response.audio = { url: audio.path, filename: audio.filename };
      // Si no hay foto, el audio es el principal
      if (!response.url) {
        response.url = audio.path;
        response.filename = audio.filename;
      }
    }

    return response;
  }
}
