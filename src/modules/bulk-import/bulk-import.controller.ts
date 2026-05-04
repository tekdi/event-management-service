import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Body,
  Param,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkImportService } from './bulk-import.service';
import { AttendanceJobStatusService } from '../attendance/attendance-job-status.service';
import { ListAttendanceJobsDto } from '../attendance/dto/list-attendance-jobs.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiParam, ApiProperty } from '@nestjs/swagger';
import { API_ID } from '../../common/utils/constants.util';
import APIResponse from '../../common/utils/response';

@ApiTags('Bulk Import')
@Controller('attendance/v1')
export class BulkImportController {
  constructor(
    private readonly bulkImportService: BulkImportService,
    private readonly jobStatusService: AttendanceJobStatusService,
  ) {}

  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import event attendance via XLSX' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        eventId: { type: 'string' },
        eventRepetitionId: { type: 'string' },
      },
    },
  })
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('eventId') eventId: string,
    @Body('eventRepetitionId') eventRepetitionId: string,
    @Req() req: any,
  ) {
    const adminUserId = req.user?.userId || 'system';
    const result = await this.bulkImportService.handleFileUpload(
      file,
      eventId,
      eventRepetitionId,
      adminUserId,
    );

    return APIResponse.success(
      API_ID.BULK_IMPORT_ATTENDANCE,
      result,
      HttpStatus.CREATED.toString(),
    );
  }

  @Post('bulk-import/status')
  @ApiOperation({ summary: 'Get bulk import job status or list jobs' })
  @ApiBody({ type: ListAttendanceJobsDto })
  async getStatusOrList(@Body() body: ListAttendanceJobsDto) {
    // If jobId is provided, return status of that specific job
    if (body.jobId) {
      const result = await this.bulkImportService.getImportJobStatus(body.jobId);
      return APIResponse.success(
        API_ID.GET_BULK_IMPORT_STATUS,
        result,
        HttpStatus.OK.toString(),
      );
    }

    // Otherwise, return a filtered list of bulk import jobs
    const limit = body.limit ?? 50;
    const offset = body.offset ?? 0;
    const contextType = body.contextType ?? 'bulk-import';

    const { jobs, total } = await this.jobStatusService.getJobs(
      body.status,
      limit,
      offset,
      body.eventRepetitionId,
      contextType,
    );

    const filters: Record<string, any> = { contextType };
    if (body.status) filters.status = body.status;
    if (body.eventRepetitionId) filters.eventRepetitionId = body.eventRepetitionId;

    return APIResponse.success(
      API_ID.LIST_ATTENDANCE_JOBS,
      {
        jobs,
        total,
        limit,
        offset,
        filters,
      },
      HttpStatus.OK.toString(),
    );
  }
}
