import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Request, Response } from 'express';
import APIResponse from '../utils/response';
import { ERROR_MESSAGES } from '../utils/constants.util';
import { LoggerWinston } from '../logger/logger.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly apiId?: string) {}

  catch(
    exception: Error | HttpException | QueryFailedError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    const errorMessage =
      exception?.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const errorResponse = APIResponse.error(
        this.apiId,
        (exception.getResponse() as any)?.message,
        ERROR_MESSAGES.BAD_REQUEST,
        statusCode.toString(),
      );
      LoggerWinston.error(
        ERROR_MESSAGES.API_REQ_FAILURE(request.url),
        errorMessage,
        request.method,
        typeof request.query === 'string' ? request.query : '',
      );

      return response.status(statusCode).json(errorResponse);
    } else if (exception instanceof QueryFailedError) {
      const statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      const errorResponse = APIResponse.error(
        this.apiId,
        (exception as QueryFailedError).message,
        ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        statusCode.toString(),
      );
      LoggerWinston.error(
        ERROR_MESSAGES.DB_QUERY_FAILURE(request.url),
        (exception as QueryFailedError).message,
        request.method,
        typeof request.query === 'string' ? request.query : '',
      );
      return response.status(statusCode).json(errorResponse);
    }
    const detailedErrorMessage = `${errorMessage}`;
    const errorResponse = APIResponse.error(
      this.apiId,
      detailedErrorMessage,
      exception instanceof HttpException
        ? exception.name
        : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      status.toString(),
    );
    LoggerWinston.error(
      ERROR_MESSAGES.API_FAILURE(request.url),
      errorResponse.result,
      request.method,
      typeof request.query === 'string' ? request.query : '',
    );
    return response.status(status).json(errorResponse);
  }
}
