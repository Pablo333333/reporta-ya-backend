import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({
      apiKey,
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper.
   * If the file buffer is missing (common with Cloudinary storage), 
   * it downloads the file from the provided URL.
   */
  async transcribeAudio(file: Express.Multer.File): Promise<string> {
    const tempPath = join(tmpdir(), `transcription-${Date.now()}-${file.originalname || 'audio.m4a'}`);
    
    try {
      if (file.buffer) {
        await writeFile(tempPath, file.buffer);
      } else if ((file as any).path) {
        // Descargar desde la URL de Cloudinary
        const response = await axios.get((file as any).path, { responseType: 'arraybuffer' });
        await writeFile(tempPath, Buffer.from(response.data));
      } else {
        this.logger.warn('No se encontró ni buffer ni ruta para el archivo de audio.');
        return '';
      }

      const transcription = await this.openai.audio.transcriptions.create({
        file: createReadStream(tempPath),
        model: 'whisper-1',
      });

      // Limpiar archivo temporal
      await unlink(tempPath).catch(err => this.logger.error('Error al borrar archivo temporal:', err));

      return transcription.text;
    } catch (error) {
      this.logger.error('Error al transcribir audio con OpenAI:', error);
      // Limpiar archivo temporal en caso de error
      await unlink(tempPath).catch(() => {});
      return ''; 
    }
  }
}
