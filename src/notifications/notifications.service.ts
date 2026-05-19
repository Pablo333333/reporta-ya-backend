import { Injectable, Logger } from '@nestjs/common';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Envía notificaciones push a través de la API HTTP de Expo.
   * Filtra tokens inválidos antes de enviar.
   */
  async sendPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const validTokens = tokens.filter(
      (t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['),
    );

    if (validTokens.length === 0) return;

    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      ...(data && { data }),
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Expo Push API respondió con ${response.status}: ${text}`);
      } else {
        this.logger.log(`Notificaciones enviadas a ${validTokens.length} dispositivo(s)`);
      }
    } catch (err) {
      this.logger.error('Error al enviar notificaciones push', err);
    }
  }
}
