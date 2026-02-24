import {
  Controller,
  Post,
  Delete,
  Body,
  Query,
  Inject,
  Optional,
  BadRequestException,
  ServiceUnavailableException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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

/** Extract S3 object key from virtual-hosted-style URL (e.g. https://bucket.s3.region.amazonaws.com/key). Decodes path so key matches S3 (e.g. %20 -> space). */
function extractS3KeyFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const rawPath = u.pathname.replace(/^\//, '');
    if (!rawPath) return null;
    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  } catch {
    return null;
  }
}

/** Normalize key: trim and remove leading slashes. */
function normalizeKey(key: string): string {
  return (key || '').trim().replace(/^\/+/, '');
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

  /**
   * Delete a file from S3 (same contract as LMS DELETE /storage/files and user service pathway delete).
   * Query param `key` can be the full S3 URL (virtual-hosted style) or the S3 object key.
   * Key must be under EVENT_CONFIG_PATH when that env is set.
   */
  @Delete('files')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete file from event S3 storage' })
  @ApiQuery({ name: 'key', required: true, description: 'Full S3 URL or S3 object key (must be under event upload path)' })
  @ApiResponse({ status: 200, description: 'File deleted (envelope via APIResponse)' })
  @ApiResponse({ status: 400, description: 'Missing key or key not under event upload path' })
  @ApiResponse({ status: 503, description: 'Cloud storage not configured' })
  async deleteFile(@Query('key') key: string) {
    if (!this.cloudStorageService) {
      throw new ServiceUnavailableException(
        'Cloud storage not configured. Set CLOUD_STORAGE_* env and ensure @tekdi/nestjs-cloud-storage is installed.',
      );
    }
    const raw = (key ?? '').trim();
    if (!raw) {
      throw new BadRequestException("Query parameter 'key' (file URL or S3 key) is required");
    }
    let s3Key: string;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const extracted = extractS3KeyFromUrl(raw);
      if (!extracted) {
        throw new BadRequestException('Invalid file URL; could not extract S3 key');
      }
      s3Key = extracted;
    } else {
      s3Key = normalizeKey(raw);
    }
    const uploadPath = this.configService.get<string>('EVENT_CONFIG_PATH');
    const prefix = (uploadPath ?? '').trim().replace(/\/+$/, '');
    const prefixWithSlash = prefix ? `${prefix}/` : '';
    if (prefixWithSlash && !s3Key.startsWith(prefixWithSlash)) {
      throw new BadRequestException(
        `File key must be under event storage prefix (${prefix}/), not outside it`,
      );
    }
    await this.cloudStorageService.deleteFile(s3Key);
    return APIResponse.success(API_ID.STORAGE_DELETE, { deleted: true, key: s3Key }, '200');
  }
}
