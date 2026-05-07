import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkImportService } from './bulk-import.service';
import { AttendanceJobStatusService } from '../attendance/attendance-job-status.service';
import { ListAttendanceJobsDto } from '../attendance/dto/list-attendance-jobs.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBasicAuth } from '@nestjs/swagger';
import { API_ID } from '../../common/utils/constants.util';
import APIResponse from '../../common/utils/response';
import { GetUserId } from 'src/common/decorators/userId.decorator';

@ApiTags('Bulk Import')
@Controller('attendance/v1')
@ApiBasicAuth('access-token')
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
        cohortId: { type: 'string' },
        lessonId: { type: 'string' },
        courseId: { type: 'string' },
      },
    },
  })
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Body('eventId') eventId: string,
    @Body('cohortId') cohortId: string,
    @Body('lessonId') lessonId: string,
    @Body('courseId') courseId: string,
    @Req() req: any,
    @GetUserId() adminUserId: string,
  ) {
    const result = await this.bulkImportService.handleFileUpload(
      file,
      eventId,
      cohortId,
      lessonId,
      courseId,
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
      const result = await this.bulkImportService.getImportJobStatus(
        body.jobId,
      );
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
    if (body.eventRepetitionId)
      filters.eventRepetitionId = body.eventRepetitionId;

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
