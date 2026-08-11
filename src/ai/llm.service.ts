import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

export type ClasificacionMetodo = 'keywords' | 'llm' | 'hibrido' | 'fallback';

export interface ClasificacionResultado {
  categoria: string;
  prioridad: string;
  razon: string;
  confianza: number;
  metodo: ClasificacionMetodo;
  provider?: 'openai' | 'none';
}

interface CategoriaActiva {
  id: string;
  nombre: string;
  descripcion: string | null;
}

const LLM_TIMEOUT_MS = 6_000;
const APRENDIZAJE_LIMIT = 8;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Clasifica un reporte con pipeline híbrido:
   * keywords dinámicas (catálogo BD) → OpenAI (GPT) → fallback fail-open.
   */
  async clasificarReporte(texto: string): Promise<ClasificacionResultado> {
    const textoLimpio = (texto || '').trim();
    const [categorias, prioridades, iaEnabled] = await Promise.all([
      this.prisma.configCategoria.findMany({ where: { activo: true } }),
      this.prisma.configPrioridad.findMany({ where: { activo: true } }),
      this.isClasificacionEnabled(),
    ]);

    if (!categorias.length) {
      return {
        categoria: 'General',
        prioridad: prioridades[0]?.nombre || 'Baja',
        razon: 'No hay categorías activas configuradas.',
        confianza: 0,
        metodo: 'fallback',
        provider: 'none',
      };
    }

    const keywordHit = this.clasificarPorKeywords(textoLimpio, categorias);

    if (!iaEnabled || textoLimpio.length < 8) {
      return keywordHit
        ? { ...keywordHit, metodo: 'keywords', provider: 'none' }
        : this.fallbackResult(categorias, prioridades, 'Texto insuficiente o IA deshabilitada.');
    }

    const aprendizaje = await this.prisma.aprendizajeIa.findMany({
      where: { corregido: true },
      orderBy: { fecha: 'desc' },
      take: APRENDIZAJE_LIMIT,
    });

    try {
      const llm = await this.llamarOpenAi(
        textoLimpio,
        categorias,
        prioridades.map((p) => p.nombre),
        aprendizaje.map((a) => ({
          texto: a.textoReporte,
          sugerida: a.categoriaSugerida,
          real: a.categoriaReal,
        })),
      );

      if (!llm) {
        return keywordHit
          ? { ...keywordHit, metodo: 'keywords', provider: 'none' }
          : this.fallbackResult(categorias, prioridades, 'OpenAI no disponible; se usó fallback.');
      }

      const catMatch = this.matchCategoria(llm.categoria, categorias);
      const prioMatch = this.matchPrioridad(llm.prioridad, prioridades.map((p) => p.nombre));

      if (keywordHit && catMatch && keywordHit.categoria.toLowerCase() === catMatch.nombre.toLowerCase()) {
        return {
          categoria: catMatch.nombre,
          prioridad: prioMatch,
          razon: llm.razon,
          confianza: Math.min(0.95, Math.max(llm.confianza, keywordHit.confianza + 0.1)),
          metodo: 'hibrido',
          provider: 'openai',
        };
      }

      return {
        categoria: catMatch?.nombre || keywordHit?.categoria || categorias[0].nombre,
        prioridad: prioMatch,
        razon: llm.razon,
        confianza: catMatch ? llm.confianza : Math.max(0.35, keywordHit?.confianza ?? 0.3),
        metodo: keywordHit ? 'hibrido' : 'llm',
        provider: 'openai',
      };
    } catch (error) {
      this.logger.warn(`Fail-open en clasificarReporte: ${(error as Error).message}`);
      return keywordHit
        ? { ...keywordHit, metodo: 'keywords', provider: 'none' }
        : this.fallbackResult(categorias, prioridades, 'Error/timeout OpenAI; fallback aplicado.');
    }
  }

  private async isClasificacionEnabled(): Promise<boolean> {
    const flag = await this.prisma.configSistema.findUnique({
      where: { clave: 'IA_CLASIFICACION_ENABLED' },
    });
    if (!flag) return true;
    return ['1', 'true', 'yes', 'on'].includes(flag.valor.toLowerCase());
  }

  private clasificarPorKeywords(
    texto: string,
    categorias: CategoriaActiva[],
  ): ClasificacionResultado | null {
    if (!texto) return null;
    const t = this.normalize(texto);
    let best: { cat: CategoriaActiva; score: number; hits: string[] } | null = null;

    for (const cat of categorias) {
      const tokens = this.tokensFromCategoria(cat);
      const hits = tokens.filter((tok) => t.includes(tok));
      if (!hits.length) continue;
      const score = hits.length / Math.max(tokens.length, 1);
      if (!best || score > best.score || (score === best.score && hits.length > best.hits.length)) {
        best = { cat, score, hits };
      }
    }

    if (!best) return null;

    const prioridad =
      best.hits.some((h) => ['derrumbe', 'urgente', 'peligro', 'accidente'].includes(h))
        ? 'Urgente'
        : best.score >= 0.5
          ? 'Media'
          : 'Baja';

    return {
      categoria: best.cat.nombre,
      prioridad,
      razon: `Coincidencia por palabras clave: ${best.hits.slice(0, 4).join(', ')}.`,
      confianza: Math.min(0.85, 0.45 + best.score * 0.4),
      metodo: 'keywords',
      provider: 'none',
    };
  }

  private tokensFromCategoria(cat: CategoriaActiva): string[] {
    const raw = `${cat.nombre} ${cat.descripcion || ''}`;
    const stop = new Set([
      'de', 'la', 'el', 'los', 'las', 'en', 'por', 'con', 'del', 'una', 'un', 'y', 'o',
      'para', 'al', 'se', 'su', 'no', 'a',
    ]);
    return this.normalize(raw)
      .split(/[^a-záéíóúñü0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !stop.has(w));
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private async llamarOpenAi(
    texto: string,
    categorias: CategoriaActiva[],
    prioridades: string[],
    ejemplos: Array<{ texto: string; sugerida: string; real: string }>,
  ): Promise<{
    categoria: string;
    prioridad: string;
    razon: string;
    confianza: number;
  } | null> {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiKey) {
      this.logger.warn('Sin OPENAI_API_KEY; se omite clasificación LLM.');
      return null;
    }

    const prompt = this.buildPrompt(texto, categorias, prioridades, ejemplos);
    const client = new OpenAI({ apiKey: openaiKey, timeout: LLM_TIMEOUT_MS });
    const model =
      this.configService.get<string>('OPENAI_CLASSIFY_MODEL') || 'gpt-4o-mini';

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Clasificas reportes ciudadanos. Respondes únicamente JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResponse(raw);
  }

  private buildPrompt(
    texto: string,
    categorias: CategoriaActiva[],
    prioridades: string[],
    ejemplos: Array<{ texto: string; sugerida: string; real: string }>,
  ): string {
    const cats = categorias
      .map((c) => `- ${c.nombre}${c.descripcion ? `: ${c.descripcion}` : ''}`)
      .join('\n');
    const fewShot = ejemplos.length
      ? ejemplos
          .map(
            (e) =>
              `Texto: "${e.texto.substring(0, 120)}" → Categoría correcta: ${e.real}` +
              (e.sugerida !== e.real ? ` (antes se sugirió ${e.sugerida})` : ''),
          )
          .join('\n')
      : 'Sin ejemplos previos.';

    return `Eres un clasificador de reportes ciudadanos territoriales.
Debes responder SOLO un JSON válido con esta forma exacta:
{"categoria":"<una de la lista>","prioridad":"<una de la lista>","razon":"<breve>","confianza":0.0}

Categorías permitidas:
${cats}

Prioridades permitidas: ${prioridades.join(', ') || 'Baja, Media, Urgente'}

Ejemplos de correcciones humanas:
${fewShot}

Texto del reporte a clasificar:
"""${texto.substring(0, 1500)}"""`;
  }

  private parseJsonResponse(raw: string): {
    categoria: string;
    prioridad: string;
    razon: string;
    confianza: number;
  } {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const confianzaNum = Number(parsed.confianza);
    return {
      categoria: String(parsed.categoria || ''),
      prioridad: String(parsed.prioridad || 'Baja'),
      razon: String(parsed.razon || 'Clasificación por OpenAI.'),
      confianza: Number.isFinite(confianzaNum)
        ? Math.min(1, Math.max(0, confianzaNum))
        : 0.6,
    };
  }

  private matchCategoria(nombre: string, categorias: CategoriaActiva[]) {
    const n = this.normalize(nombre);
    return (
      categorias.find((c) => this.normalize(c.nombre) === n) ||
      categorias.find((c) => n.includes(this.normalize(c.nombre)) || this.normalize(c.nombre).includes(n))
    );
  }

  private matchPrioridad(nombre: string, prioridades: string[]): string {
    const n = this.normalize(nombre);
    const hit = prioridades.find((p) => this.normalize(p) === n);
    if (hit) return hit;
    if (n.includes('alta') || n.includes('urgent')) {
      return prioridades.find((p) => /urgent|alta/i.test(p)) || prioridades[prioridades.length - 1];
    }
    if (n.includes('media')) {
      return prioridades.find((p) => /media/i.test(p)) || prioridades[0];
    }
    return prioridades.find((p) => /baja/i.test(p)) || prioridades[0] || 'Baja';
  }

  private fallbackResult(
    categorias: CategoriaActiva[],
    prioridades: Array<{ nombre: string }>,
    razon: string,
  ): ClasificacionResultado {
    return {
      categoria: categorias[0].nombre,
      prioridad: prioridades.find((p) => /baja/i.test(p.nombre))?.nombre || prioridades[0]?.nombre || 'Baja',
      razon,
      confianza: 0.25,
      metodo: 'fallback',
      provider: 'none',
    };
  }
}
