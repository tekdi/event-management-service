import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RolePermissionService } from '../modules/permissionRbac/rolePermissionMapping/role-permission-mapping.service';
import { LoggerWinston } from 'src/common/logger/logger.util';

@Injectable()
export class PermissionMiddleware implements NestMiddleware {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    LoggerWinston.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    let role = '';
    if (req.headers.authorization) {
      role = this.getRole(req.headers.authorization);
    } else {
      role = 'public';
    }
    //FOR ASPIRE LEADER WE DONT NEED TO CHECK THE PERMISSIONS
    const isPermissionValid = true; // await this.checkPermissions(
    //   role,
    //   req.baseUrl,
    //   req.method,
    // );
    if (isPermissionValid) return next();
    else {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }
  async checkPermissions(
    roleTitle: string,
    requestPath: string,
    requestMethod: string,
  ) {
    const parts = requestPath.match(/[^/]+/g);
    let apiPath = '';
    if (roleTitle === 'public') {
      apiPath = requestPath;
    } else {
      apiPath = this.getApiPaths(parts);
    }
    const allowedPermissions = await this.fetchPermissions(roleTitle, apiPath);
    return allowedPermissions.some((permission) =>
      permission.requestType.includes(requestMethod),
    );
  }
  getApiPaths(parts: string[]) {
    let apiPath = '';
    if (parts.length == 3) apiPath = `/${parts[0]}/${parts[1]}/*`;
    if (parts.length > 3) apiPath = `/${parts[0]}/${parts[1]}/${parts[2]}/*`;

    LoggerWinston.log('apiPath: ', apiPath);
    return apiPath;
  }
  async fetchPermissions(roleTitle: string, apiPath: string) {
    return await this.rolePermissionService.getPermissionForMiddleware(
      roleTitle,
      apiPath,
    );
  }
  getRole(token: string) {
    const payloadBase64 = token.split('.')[1]; // Get the payload part
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8'); // Decode Base64
    const payload = JSON.parse(payloadJson); // Convert to JSON
    return payload.user_roles;
  }
}
