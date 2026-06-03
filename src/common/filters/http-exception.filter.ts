import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const logData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      exceptionResponse,
      body: request.body,
      params: request.params,
      query: request.query,
    };

    // Logueamos el error completo para debugging forense
    this.logger.error(
      `[DEBUG ERROR 400] Detalle completo de la excepción: ${JSON.stringify(logData, null, 2)}`,
    );

    response.status(status).json(exceptionResponse);
  }
}
