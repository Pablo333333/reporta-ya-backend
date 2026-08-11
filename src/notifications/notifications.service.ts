import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo recomienda como máximo ~100 mensajes por request. */
const EXPO_CHUNK_SIZE = 100;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; [key: string]: unknown };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envía una notificación push individual al token Expo del usuario.
   * Nunca lanza: fallos de red/token se registran y se ignoran.
   */
  async sendPushNotification(
    expoPushToken: string,
    titulo: string,
    cuerpo: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (!this.isExpoPushToken(expoPushToken)) {
        this.logger.warn(`Token push inválido (se omite): ${this.maskToken(expoPushToken)}`);
        return;
      }

      await this.dispatchToExpo([
        {
          to: expoPushToken,
          title: titulo,
          body: cuerpo,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          ...(data && { data }),
        },
      ]);
    } catch (error) {
      this.logger.error(
        `Fallo al enviar push individual: ${this.errorMessage(error)}`,
      );
    }
  }

  /**
   * Envío masivo (p. ej. todos los RESPONSABLE con token).
   * Deduplica tokens, filtra inválidos y envía en chunks a la API de Expo.
   * Nunca lanza excepciones al caller.
   */
  async sendPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const uniqueValid = [
        ...new Set(
          tokens.filter((t): t is string => typeof t === 'string' && this.isExpoPushToken(t)),
        ),
      ];

      if (uniqueValid.length === 0) {
        this.logger.warn('No se encontraron tokens Expo válidos para envío masivo.');
        return;
      }

      this.logger.log(`Enviando push a ${uniqueValid.length} dispositivo(s)…`);

      const messages: ExpoPushMessage[] = uniqueValid.map((to) => ({
        to,
        title,
        body,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        ...(data && { data }),
      }));

      await this.dispatchToExpo(messages);
    } catch (error) {
      this.logger.error(
        `Fallo al enviar push masivo: ${this.errorMessage(error)}`,
      );
    }
  }

  /**
   * Alerta por mensajería instantánea (aún simulada: WhatsApp/Twilio).
   */
  async sendInstantMessengerAlert(mensaje: string): Promise<void> {
    this.logger.log(`
      💬 [INSTANT MESSENGER ALERT]
      PLATFORM: WhatsApp/Twilio/Bot
      MESSAGE: ${mensaje}
      STATUS: Simulado (no integrado) 🚨
    `);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async dispatchToExpo(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const chunks = this.chunk(messages, EXPO_CHUNK_SIZE);
    for (const chunk of chunks) {
      await this.postChunk(chunk);
    }
  }

  private async postChunk(messages: ExpoPushMessage[]): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN');
    if (accessToken?.trim()) {
      headers.Authorization = `Bearer ${accessToken.trim()}`;
    }

    try {
      const { data } = await axios.post<{ data?: ExpoPushTicket[] }>(
        EXPO_PUSH_URL,
        messages,
        { headers, timeout: 15_000 },
      );

      const tickets = data?.data ?? [];
      let ok = 0;
      let errors = 0;

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          ok += 1;
          return;
        }
        errors += 1;
        const token = messages[index]?.to;
        this.logger.warn(
          `Ticket Expo error [${ticket.details?.error ?? 'unknown'}] ` +
            `token=${this.maskToken(token)} msg=${ticket.message ?? 'sin detalle'}`,
        );
      });

      this.logger.log(
        `Expo Push chunk: ${ok} ok, ${errors} error(es), ${messages.length} mensaje(s).`,
      );
    } catch (error) {
      // Red / 4xx / 5xx: no re-lanzar — el flujo de reportes debe continuar.
      if (axios.isAxiosError(error)) {
        const ax = error as AxiosError;
        this.logger.error(
          `HTTP Expo Push falló: status=${ax.response?.status ?? 'n/a'} ` +
            `detail=${JSON.stringify(ax.response?.data ?? ax.message)}`,
        );
      } else {
        this.logger.error(`Expo Push inesperado: ${this.errorMessage(error)}`);
      }
    }
  }

  private isExpoPushToken(token: string): boolean {
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[')
    );
  }

  private maskToken(token?: string): string {
    if (!token) return '(vacío)';
    if (token.length <= 18) return token;
    return `${token.slice(0, 20)}…${token.slice(-4)}`;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
