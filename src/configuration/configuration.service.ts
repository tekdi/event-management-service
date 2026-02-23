import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { TenantConfigValue } from './interfaces/tenant-config.interface';

export interface Config {
  path: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  storageConfig: {
    cloudStorageProvider: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    container: string;
    expiresIn: number;
  };
}

@Injectable()
export class ConfigurationService {
  private eventConfigJson: any;

  constructor(private readonly configService: ConfigService) {
    this.loadEventConfig();
  }

  /**
   * Get configuration (from local event-config.json, no cache).
   * Optionally try User Service first when USER_SERVICE_URL is set.
   */
  async getConfig(tenantId: string): Promise<Record<string, any>> {
    try {
      const externalConfig = await this.fetchExternalConfig(tenantId);
      if (externalConfig && Object.keys(externalConfig).length > 0) {
        const tenantConfig: TenantConfigValue = {
          config: externalConfig,
          lastSynced: new Date().toISOString(),
          IsConfigsSync: 1,
        };
        return tenantConfig;
      }
      const tenantConfig = await this.loadLocalConfig(tenantId);
      return tenantConfig;
    } catch (error) {
      throw new NotFoundException(
        `${RESPONSE_MESSAGES.ERROR.CONFIG_FAILED}: ${error.message}`,
      );
    }
  }

  /**
   * Sync: fetch from external service and return (no cache).
   */
  async syncTenantConfig(tenantId: string): Promise<any> {
    const externalConfig = await this.fetchExternalConfig(tenantId);
    if (externalConfig && Object.keys(externalConfig).length > 0) {
      return {
        config: externalConfig,
        lastSynced: new Date().toISOString(),
        IsConfigsSync: 1,
      };
    }
    return this.loadLocalConfig(tenantId);
  }

  /**
   * Load local configuration from event-config.json
   */
  async loadLocalConfig(tenantId: string): Promise<TenantConfigValue> {
    const config: Record<string, any> = {};
    for (const section in this.eventConfigJson.properties) {
      for (const property in this.eventConfigJson.properties[section]
        .properties) {
        const prop = this.eventConfigJson.properties[section].properties[property];
        if (prop.default !== undefined) {
          config[property] = prop.default;
        }
      }
    }
    return {
      config,
      lastSynced: new Date().toISOString(),
      IsConfigsSync: 1,
    };
  }

  async fetchExternalConfig(tenantId: string): Promise<any> {
    try {
      const externalConfigUrl = this.configService.get('USER_SERVICE_URL');
      if (!externalConfigUrl) {
        return {};
      }
      const response = await axios.get(
        `${externalConfigUrl}/tenant/${tenantId}?context=event`,
      );
      return response.data?.result ?? {};
    } catch {
      return {};
    }
  }

  private loadEventConfig() {
    const envPath = this.configService.get('EVENT_CONFIG_FILE_PATH');
    const candidates = envPath
      ? [path.resolve(process.cwd(), envPath)]
      : [
          path.join(process.cwd(), 'src/event-config.json'),
          path.join(process.cwd(), 'event-config.json'),
          path.join(__dirname, '..', 'event-config.json'),
          path.join(__dirname, '..', '..', 'src/event-config.json'),
        ];
    for (const configPath of candidates) {
      try {
        if (fs.existsSync(configPath)) {
          this.eventConfigJson = JSON.parse(
            fs.readFileSync(configPath, 'utf8'),
          );
          return;
        }
      } catch {
        continue;
      }
    }
    // Fallback so app starts even when file is missing (e.g. not copied to dist)
    this.eventConfigJson = this.getDefaultEventConfig();
  }

  private getDefaultEventConfig(): any {
    return {
      properties: {
        General: {
          properties: {
            date_format: { default: 'Y-m-d H:i:s' },
          },
        },
        'Cloud-Agnostic Settings': {
          properties: {
            cloud_storage_provider: { default: 'aws' },
            storage_key: { default: '' },
            storage_secret: { default: '' },
            storage_container: { default: '' },
            storage_region: { default: '' },
            presigned_url_expires_in: { default: 3600 },
          },
        },
        'Media Settings': {
          properties: {
            image_mime_type: {
              default: 'image/jpeg, image/jpg, image/png',
            },
            image_filesize: { default: 5 },
            event_upload_path: { default: 'events' },
          },
        },
      },
    };
  }

  private getStorageConfig(tenantConfig: TenantConfigValue) {
    return {
      cloudStorageProvider: tenantConfig.config['cloud_storage_provider'],
      region: tenantConfig.config['storage_region'],
      accessKeyId: tenantConfig.config['storage_key'],
      secretAccessKey: tenantConfig.config['storage_secret'],
      container: tenantConfig.config['storage_container'],
      expiresIn: Number(tenantConfig.config['presigned_url_expires_in']),
    };
  }

  getEntityConfigs(
    entityType: string,
    tenantConfig: TenantConfigValue,
  ): Config {
    const entityConfigMap: Record<
      string,
      { path: string; maxFileSize: string; allowedMimeTypes: string }
    > = {
      event: {
        path: 'event_upload_path',
        maxFileSize: 'image_filesize',
        allowedMimeTypes: 'image_mime_type',
      },
    };
    const entityConfig = entityConfigMap[entityType];
    if (!entityConfig) {
      throw new BadRequestException(
        `${RESPONSE_MESSAGES.ERROR.INVALID_UPLOAD_TYPE}: ${entityType}`,
      );
    }
    const pathVal = tenantConfig.config[entityConfig.path];
    const maxFileSizeVal = tenantConfig.config[entityConfig.maxFileSize];
    const allowedMimeTypesVal = tenantConfig.config[entityConfig.allowedMimeTypes];
    return {
      path: pathVal,
      maxFileSize: typeof maxFileSizeVal === 'number' ? maxFileSizeVal * 1024 * 1024 : 5 * 1024 * 1024,
      allowedMimeTypes: Array.isArray(allowedMimeTypesVal)
        ? allowedMimeTypesVal
        : (typeof allowedMimeTypesVal === 'string'
            ? allowedMimeTypesVal.split(',').map((s: string) => s.trim())
            : ['image/jpeg', 'image/png']),
      storageConfig: this.getStorageConfig(tenantConfig),
    };
  }
}
