import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // `getResponse()` devolve o objeto { statusCode, message, error } para
    // exceções criadas com string; achatamos para expor `message` como
    // string|array (formato padrão NestJS que o frontend sabe extrair) e
    // evitar o objeto aninhado que virava "Error sending code" no cliente.
    const rawResponse: unknown =
      exception instanceof HttpException ? exception.getResponse() : 'Erro interno no servidor';
    const message =
      typeof rawResponse === 'string'
        ? rawResponse
        : ((rawResponse as { message?: unknown })?.message ?? rawResponse);

    const payload = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (!(exception instanceof HttpException)) {
      if (exception instanceof Error) {
        this.logger.error('Unhandled exception', exception.stack);
      } else {
        this.logger.error('Unhandled exception', JSON.stringify(exception));
      }
    }

    response.status(status).json(payload);
  }
}
