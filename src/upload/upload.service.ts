import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  /**
   * Elimina un archivo de Cloudinary a partir de su publicId o URL.
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Archivo eliminado de Cloudinary: ${publicId}`);
    } catch (err: unknown) {
      this.logger.error(`Error al eliminar ${publicId} de Cloudinary`, err);
      throw new InternalServerErrorException('Error al eliminar el archivo de Cloudinary');
    }
  }
}
