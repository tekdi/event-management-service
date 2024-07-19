import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Response } from 'express';
import APIResponse from '../utils/response';
import { ERROR_MESSAGES } from '../utils/constants.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly apiId?: string) {}

  catch(exception: unknown, host: ArgumentsHost) {
    console.log('exception', exception);
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

    if (exception instanceof QueryFailedError) {
      const statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      const errorResponse = APIResponse.error(
        this.apiId,
        (exception as QueryFailedError).message,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode.toString(),
      );
      return response.status(statusCode).json(errorResponse);
    }
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
