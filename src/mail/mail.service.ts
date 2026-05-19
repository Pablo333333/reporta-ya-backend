import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: this.configService.get<boolean>('MAIL_SECURE', false),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendNewReportEmail(to: string, reportDetails: any) {
    const { id, tipoProblema, comentario, latitud, longitud, zona, reportante } = reportDetails;
    const operarioNombre = reportante?.email || 'Anónimo';
    const zonaNombre = zona || 'No especificada';
    const googleMapsLink = `https://www.google.com/maps?q=${latitud},${longitud}`;
    
    const mailOptions = {
      from: `"Reporta Ya" <${this.configService.get<string>('MAIL_FROM')}>`,
      to,
      subject: `🆕 NUEVO REPORTE - ${tipoProblema.replace(/_/g, ' ')}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h1 style="color: #1a73e8;">Nuevo Reporte en la Vía</h1>
          <p>Se ha registrado una nueva novedad que requiere su revisión.</p>
          <hr />
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Operario:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${operarioNombre}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Zona:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${zonaNombre}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tipo de Problema:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${tipoProblema.replace(/_/g, ' ')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Comentario:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${comentario || 'Sin comentario'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Ubicación:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">
                <a href="${googleMapsLink}" style="color: #1a73e8; text-decoration: none;">Ver en Google Maps (${latitud}, ${longitud})</a>
              </td>
            </tr>
          </table>
          <p style="margin-top: 20px;">Por favor, ingrese al panel de administración para gestionar este reporte.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Correo de nuevo reporte enviado a ${to} para el reporte ${id}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo de nuevo reporte: ${error.message}`);
    }
  }
}
