import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      tenantId: request.headers['tenantid'],
      organisationId: request.headers['organisationid'],
    };
  },
);
