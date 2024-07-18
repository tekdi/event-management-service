import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import APIResponse from '../utils/response';
import { ERROR_MESSAGES } from '../utils/constants.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly apiId?: string) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const errorMessage =
      exception instanceof HttpException
        ? (exceptionResponse as any).message || exception.message
        : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    const detailedErrorMessage = `${errorMessage}`;
    console.log('detailedErrorMessage', detailedErrorMessage);
    const errorResponse = APIResponse.error(
      this.apiId,
      detailedErrorMessage,
      exception instanceof HttpException
        ? exception.name
        : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      status.toString(),
    );
    return response.status(status).json(errorResponse);
  }
}
