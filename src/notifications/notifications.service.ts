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
   * Envía una notificación push individual (Simulado para desarrollo)
   */
  async sendPushNotification(expoPushToken: string, titulo: string, cuerpo: string): Promise<void> {
    this.logger.log(`
      📱 [EXPO PUSH NOTIFICATION]
      TO: ${expoPushToken}
      TITLE: ${titulo}
      BODY: ${cuerpo}
      STATUS: Simulado con éxito ✅
    `);
    
    // Aquí se integraría expo-server-sdk en el futuro
  }

  /**
   * Envía una alerta por mensajería instantánea (Simulado para desarrollo)
   */
  async sendInstantMessengerAlert(mensaje: string): Promise<void> {
    this.logger.log(`
      💬 [INSTANT MESSENGER ALERT]
      PLATFORM: WhatsApp/Twilio/Bot
      MESSAGE: ${mensaje}
      STATUS: Simulado con éxito 🚨
    `);
    
    // Aquí se integraría la API de Twilio o Telegram en el futuro
  }

  /**
   * Envía notificaciones push a través de la API HTTP de Expo (Mantenido por compatibilidad)
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

    if (validTokens.length === 0) {
      this.logger.warn('No se encontraron tokens válidos para enviar notificaciones push.');
      return;
    }

    this.logger.log(`🚀 Enviando notificaciones push a ${validTokens.length} dispositivos...`);

    // Simulación descriptiva para múltiples tokens
    validTokens.forEach(token => {
      this.sendPushNotification(token, title, body);
    });
  }
}
