import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBasicAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventAttendeesDTO } from './dto/EventAttendance.dto';
import { AttendeesService } from './attendees.service';
import { Response } from 'express';
import { SearchAttendeesDto } from './dto/searchAttendees.dto';
import { UpdateAttendeesDto } from './dto/updateAttendees.dto';
import { GetUserId } from 'src/common/decorators/userId.decorator';
import { EnrollmentDto } from './dto/provider-enrollment.dto';
import { DeleteEnrollmentDto } from './dto/delete-enrollment.dto';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import { API_ID } from 'src/common/utils/constants.util';
import { Search_Event_AttendeesDto } from './dto/search-attendees.dto';

@Controller('attendees/v1')
@ApiTags('Event-Attendees')
@ApiBasicAuth('access-token')
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Post('/create')
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({ type: EventAttendeesDTO })
  @ApiCreatedResponse({
    description: 'Created Event',
  })
  async create(
    @Body() eventAttendeesDTO: EventAttendeesDTO,
    @Res() response: Response,
    @GetUserId() userId: string,
  ) {
    eventAttendeesDTO.enrolledBy = userId;
    return this.attendeesService.createAttendees(
      eventAttendeesDTO,
      response,
      userId,
    );
  }

  @Post('/list')
  @ApiOkResponse({ description: 'Get attendees Details' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({ type: SearchAttendeesDto })
  async getAttendees(
    @Body() searchAttendeesDto: SearchAttendeesDto,
    @Res() response: Response,
  ) {
    if (
      !searchAttendeesDto ||
      (!searchAttendeesDto.eventId && !searchAttendeesDto.userId)
    ) {
      throw new BadRequestException('Please do not pass empty body');
    }
    return this.attendeesService.getAttendees(searchAttendeesDto, response);
  }

  @Patch()
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @ApiOkResponse({ description: 'updated successfully' })
  @ApiBody({ type: UpdateAttendeesDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Body() updateAttendeesDto: UpdateAttendeesDto,
    @Res() response: Response,
  ) {
    return this.attendeesService.updateAttendees(updateAttendeesDto, response);
  }

  @Delete()
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOkResponse({ description: 'Deleted successfully' })
  @ApiBody({ type: SearchAttendeesDto })
  remove(
    @Body() searchAttendeesDto: SearchAttendeesDto,
    @Res() response: Response,
  ) {
    if (
      !searchAttendeesDto ||
      (!searchAttendeesDto.eventId && !searchAttendeesDto.userId)
    ) {
      throw new BadRequestException('Please do not pass empty body');
    }
    return this.attendeesService.deleteAttendees(searchAttendeesDto, response);
  }

  @Post('enroll')
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({ type: EnrollmentDto })
  @ApiCreatedResponse({
    description: 'User enrolled to meeting successfully',
  })
  async enrollToProviderMeeting(
    @Body() enrollmentDto: EnrollmentDto,
    @Res() response: Response,
    @GetUserId() userId: string,
  ) {
    return this.attendeesService.enrollUserToMeeting(
      enrollmentDto,
      response,
      userId,
    );
  }

  @Delete('enroll')
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({ type: DeleteEnrollmentDto })
  @ApiOkResponse({
    description: 'User enrollment deleted successfully',
  })
  async deleteEnrollment(
    @Body() deleteEnrollmentDto: DeleteEnrollmentDto,
    @Res() response: Response,
  ) {
    return this.attendeesService.deleteEnrollment(
      deleteEnrollmentDto,
      response,
    );
  }

  @Get('/:eventId/:userId')
  @ApiOkResponse({ description: 'Get attendee details by eventId and userId' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENT_ATTENDEE))
  async getAttendeeByEventAndUser(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Query('eventRepetitionId') eventRepetitionId: string,
    @Res() response: Response,
  ) {
    return this.attendeesService.getAttendeeByEventAndUser(
      eventId,
      eventRepetitionId,
      userId,
      response,
    );
  }

// Aspire Leader Specific API
// Return Events details and attendees details for a given user id
  @Post('search')
  @ApiOkResponse({ 
    description: 'Search attendees with different filters (userId, eventIds) with offset-based pagination. Supports arrays of IDs.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        apiId: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            attendees: { type: 'array' },
            pagination: {
              type: 'object',
              properties: {
                offset: { type: 'number' },
                currentPage: { type: 'number' },
                totalPages: { type: 'number' },
                totalCount: { type: 'number' },
                limit: { type: 'number' },
                hasNextPage: { type: 'boolean' },
                hasPreviousPage: { type: 'boolean' }
              }
            },
            searchType: { 
              type: 'string',
              enum: ['user_events', 'event_attendees', 'combined_filters']
            },
            message: { type: 'string' },
            filters: {
              type: 'object',
              properties: {
                userIds: { type: 'array', items: { type: 'string' }, nullable: true },
                eventIds: { type: 'array', items: { type: 'string' }, nullable: true },
                eventRepetitionId: { type: 'string', nullable: true }
              }
            }
          }
        },
        message: { type: 'string' }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENT_ATTENDEE))
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchAttendees(
    @Body() searchAttendeesDto: Search_Event_AttendeesDto,
    @Res() response: Response,
  ) {
    return this.attendeesService.searchAttendees(
      searchAttendeesDto,
      response,
    );
  }
}
