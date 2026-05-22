import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Clasifica un reporte utilizando un LLM (OpenAI/Gemini).
   * @param texto El texto del reporte (comentario o transcripción).
   * @returns Un objeto con la categoría y prioridad sugerida.
   */
  async clasificarReporte(texto: string): Promise<{ categoria: string; prioridad: string; razon: string }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('GEMINI_API_KEY');

    // Fetch dinámico de categorías y estados activos para el prompt
    const [categorias, estados] = await Promise.all([
      this.prisma.configCategoria.findMany({ where: { activo: true } }),
      this.prisma.configEstado.findMany({ where: { activo: true } }),
    ]);

    const contexto = `
      Categorías disponibles: ${categorias.map(c => c.nombre).join(', ')}.
      Estados del flujo: ${estados.map(e => e.nombre).join(', ')}.
      Instrucción: Clasifica el reporte en una de las categorías y sugiere una prioridad (Baja, Media, Alta, Urgente).
    `;

    if (!apiKey) {
      this.logger.warn('No se detectó API Key para LLM. Usando clasificación por Mock.');
      return this.obtenerMock(texto, categorias);
    }

    try {
      this.logger.log(`Simulando llamada a LLM para: "${texto.substring(0, 30)}..." con contexto dinámico.`);
      return this.obtenerMock(texto, categorias);
    } catch (error) {
      this.logger.error('Error en la llamada al LLM:', error);
      return this.obtenerMock(texto, categorias);
    }
  }

  private obtenerMock(texto: string, categorias: any[]) {
    const t = texto.toLowerCase();
    
    // Intentar matchear con categorías reales de la DB
    if (t.includes('basura') || t.includes('olor') || t.includes('residuo')) {
      const cat = categorias.find(c => c.nombre.toLowerCase().includes('ambiental')) || categorias[0];
      return { categoria: cat.nombre, prioridad: 'Media', razon: 'Detectado por palabras clave ambientales.' };
    }
    if (t.includes('bache') || t.includes('pozo') || t.includes('calle') || t.includes('vía')) {
      const cat = categorias.find(c => c.nombre.toLowerCase().includes('vial')) || categorias[0];
      return { categoria: cat.nombre, prioridad: 'Alta', razon: 'Detectado por riesgo de accidente vial.' };
    }
    
    return { categoria: categorias[0]?.nombre || 'General', prioridad: 'Baja', razon: 'No se detectaron patrones críticos.' };
  }
}
