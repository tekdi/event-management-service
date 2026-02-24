import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';
import { API_ID } from '../common/utils/constants.util';
import APIResponse from '../common/utils/response';

@ApiTags('Configuration')
@Controller('config')
export class ConfigController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Get()
  @ApiOperation({ summary: 'Get event upload configuration' })
  @ApiResponse({ status: 200, description: 'Configuration (envelope via APIResponse)' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async getConfig(
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const data = await this.configurationService.getConfig(tenantOrg.tenantId);
    if (data?.config && typeof data.config.image_filesize === 'number') {
      data.config.image_filesize = String(data.config.image_filesize);
    }
    return APIResponse.success(API_ID.GET_CONFIG, data, '200');
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync configuration from external service' })
  @ApiResponse({ status: 200, description: 'Configuration synced' })
  @ApiResponse({ status: 400, description: 'Invalid tenant ID' })
  @ApiResponse({ status: 500, description: 'Failed to sync configuration' })
  async syncTenantConfig(
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    const data = await this.configurationService.syncTenantConfig(tenantOrg.tenantId);
    if (data?.config && typeof data.config.image_filesize === 'number') {
      data.config.image_filesize = String(data.config.image_filesize);
    }
    return APIResponse.success(API_ID.SYNC_CONFIG, data, '200');
  }
}
