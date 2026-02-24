import {
  Controller,
  Post,
  Body,
  Inject,
  Optional,
  ServiceUnavailableException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { API_ID } from '../common/utils/constants.util';
import APIResponse from '../common/utils/response';

/** DTO matching @tekdi/nestjs-cloud-storage GeneratePresignedUrlDto */
export class PresignedUrlBodyDto {
  key: string;
  contentType?: string;
  metadata?: Record<string, string>;
  expiresIn?: number;
  sizeLimit?: number;
}

/** Build S3 key with prefix from env EVENT_CONFIG_PATH (e.g. event/images/) */
function buildStorageKey(userKey: string, uploadPath: string | undefined): string {
  const key = (userKey || '').trim();
  if (!key) return key;
  const prefix = (uploadPath || '').trim().replace(/\/+$/, '');
  if (!prefix) return key;
  return `${prefix}/${key}`;
}

@ApiTags('Storage')
@Controller('storage')
export class EventStorageController {
  constructor(
    @Optional()
    @Inject('CloudStorageService')
    private readonly cloudStorageService: any,
    private readonly configService: ConfigService,
  ) {}

  @Post('presigned-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get presigned URL for S3 upload' })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL and fields (envelope via APIResponse)',
  })
  @ApiResponse({
    status: 503,
    description: 'Cloud storage not configured (set CLOUD_STORAGE_* env)',
  })
  async generatePresignedUrl(@Body() dto: PresignedUrlBodyDto) {
    if (!this.cloudStorageService) {
      throw new ServiceUnavailableException(
        'Cloud storage not configured. Set CLOUD_STORAGE_PROVIDER, CLOUD_STORAGE_REGION, CLOUD_STORAGE_ACCESS_KEY_ID, CLOUD_STORAGE_SECRET_ACCESS_KEY, CLOUD_STORAGE_BUCKET_NAME and ensure @tekdi/nestjs-cloud-storage is installed.',
      );
    }
    const uploadPath = this.configService.get<string>('EVENT_CONFIG_PATH');
    const storageKey = buildStorageKey(dto.key, uploadPath);
    const dtoWithKey = { ...dto, key: storageKey };
    const { url, fields } = await this.cloudStorageService.generatePresignedUrl(dtoWithKey);
    return APIResponse.success(API_ID.PRESIGNED_URL, { url, fields }, '201');
  }
}
