import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RolePermissionService } from '../modules/permissionRbac/rolePermissionMapping/role-permission-mapping.service';
import APIResponse from 'src/common/utils/response';

@Injectable()
export class PermissionMiddleware implements NestMiddleware {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    const isPermissionValid = await this.checkPermissions(
      'Admin',
      req.baseUrl,
      req.method,
      res,
    );
    if (isPermissionValid) return next();
    else {
      return APIResponse.error(
        '',
        'You do not have permission to access this resource',
        'You do not have permission to access this resource',
        '403',
      );
    }
  }

  async checkPermissions(roleTitle, requestPath, requestMethod, res) {
    const parts = requestPath.match(/[^/]+/g);
    const apiPath = this.getApiPaths(parts);
    const allowedPermissions = await this.fetchPermissions(
      roleTitle,
      apiPath,
      res,
    );

    return allowedPermissions.some((permission) =>
      permission.requestType.includes(requestMethod),
    );
  }

  getApiPaths(parts: string[]) {
    //queue/list --> /queue/*
    let apiPath = `/${parts[0]}/*`;
    console.log('apiPath: ', apiPath);
    return apiPath;
  }

  async fetchPermissions(roleTitle, apiPath, res) {
    return await this.rolePermissionService.getPermission(
      roleTitle,
      apiPath,
      res,
    );
  }
}
