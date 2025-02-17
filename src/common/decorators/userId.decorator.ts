import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { jwtDecode } from 'jwt-decode';
import { ERROR_MESSAGES } from '../utils/constants.util';

export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(ERROR_MESSAGES.AUTH_TOKEN_MISSING);
    }

    try {
      const token = authHeader.split(' ')[1]; // Extract JWT token
      const decoded: any = jwtDecode(token); // Decode token

      if (!decoded?.sub) {
        throw new UnauthorizedException(ERROR_MESSAGES.TOKEN_MISSING_USERID);
      }

      return decoded.sub;
    } catch (error) {
      throw new UnauthorizedException(ERROR_MESSAGES.AUTH_TOKEN_INVALID);
    }
  },
);
