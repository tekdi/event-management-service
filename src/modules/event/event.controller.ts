import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  UsePipes,
  Res,
  Req,
  ValidationPipe,
  BadRequestException,
  UseFilters,
  Get,
  Delete,
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateEventByIdDto } from './dto/update-event-by-id.dto';
import { DeleteEventDto } from './dto/delete-event.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiOperation,
  ApiBasicAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SearchFilterDto } from './dto/search-event.dto';
import {
  DateValidationPipe,
  RegistrationDateValidationPipe,
  AttendeesValidationPipe,
  RecurringEndDateValidationPipe,
  SearchDateValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';
import { createEventsExamplesForSwagger } from './dto/create-event-example';
import { updateEventsExamplesForSwagger } from './dto/update-event-example';
import { searchEventsExamplesForSwagger } from './dto/search-event-example';
import { GetUserId } from 'src/common/decorators/userId.decorator';

@Controller('event/v1')
@ApiTags('Event Management')
@ApiBasicAuth('access-token')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
  ) {}

  @UseFilters(new AllExceptionsFilter(API_ID.CREATE_EVENT))
  @Post('/create')
  @ApiOperation({ summary: 'Create Events' })
  @ApiBody({ type: CreateEventDto, examples: createEventsExamplesForSwagger })
  @ApiCreatedResponse({
    description: SUCCESS_MESSAGES.EVENT_CREATED,
  })
  @ApiBadRequestResponse({ description: ERROR_MESSAGES.INVALID_REQUEST_BODY })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async create(
    @Body(
      new ValidationPipe({ transform: true }),
      new DateValidationPipe(),
      new RegistrationDateValidationPipe(),
      new RecurringEndDateValidationPipe(),
      new AttendeesValidationPipe(),
    )
    createEventDto: CreateEventDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ) {
    createEventDto.createdBy = userId;
    createEventDto.updatedBy = userId;
    return this.eventService.createEvent(createEventDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.UPDATE_EVENT))
  @Patch('/event/:eventId')
  @ApiOperation({ summary: 'Update Event by Event ID - Comprehensive Update' })
  @ApiBody({ type: UpdateEventByIdDto })
  @ApiOkResponse({
    description: SUCCESS_MESSAGES.EVENT_UPDATED,
  })
  @ApiBadRequestResponse({ description: ERROR_MESSAGES.INVALID_REQUEST_BODY })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async updateEventById(
    @Param('eventId') eventId: string,
    @Body(
      new ValidationPipe({ transform: true }),
      new DateValidationPipe(),
      new RegistrationDateValidationPipe(),
      new RecurringEndDateValidationPipe(),
      new AttendeesValidationPipe(),
    )
    updateEventByIdDto: UpdateEventByIdDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ) {
    if (!updateEventByIdDto || Object.keys(updateEventByIdDto).length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST_BODY);
    }
    updateEventByIdDto.updatedBy = userId;
    return this.eventService.updateEventById(eventId, updateEventByIdDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENTS))
  @Post('/list')
  @ApiOperation({ summary: 'Search Events' })
  @ApiBody({ type: SearchFilterDto, examples: searchEventsExamplesForSwagger })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  @UsePipes(
    new ValidationPipe({ transform: true }),
    new SearchDateValidationPipe(),
  )
  @ApiOkResponse({
    description: 'Searched',
    status: 200,
  })
  async findAll(
    @Body() requestBody: SearchFilterDto,
    @Res() response: Response,
    @GetUserId() userId: string,
  ) {
    return this.eventService.getEvents(response, requestBody, userId);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.UPDATE_EVENT))
  @Patch('/:id') // eventRepetitionId
  @ApiOperation({ summary: 'Edit Events with Enhanced Online Meeting Support' })
  @ApiBody({ type: UpdateEventDto, examples: updateEventsExamplesForSwagger })
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_UPDATED })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  updateEvent(
    @Param('id') id: string,
    @Body(
      new ValidationPipe({ transform: true }),
      new DateValidationPipe(),
      new RegistrationDateValidationPipe(),
      new RecurringEndDateValidationPipe(),
      new AttendeesValidationPipe(),
    )
    updateEventDto: UpdateEventDto,
    @Res() response: Response,
    @Req() request: Request,
    @GetUserId() userId: string,
  ) {
    if (!updateEventDto || Object.keys(updateEventDto).length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST_BODY);
    }
    updateEventDto.updatedBy = userId;
    return this.eventService.updateEvent(id, updateEventDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.DELETE_EVENT))
  @Delete('/:id') // eventRepetitionId
  @ApiOperation({ summary: 'Delete Event Repetition and Optionally Main Event with Online Meeting Cleanup' })
  @ApiBody({ type: DeleteEventDto })
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_DELETED })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  deleteEvent(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true }))
    deleteEventDto: DeleteEventDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.eventService.deleteEventRepetition(id, deleteEventDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENT_BY_ID))
  @Get('/:eventId')
  @ApiOperation({ summary: 'Get Event by Event ID with all repetition events' })
  @ApiOkResponse({
    description: 'Event fetched successfully with all repetitions',
    status: 200,
  })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async getEventById(
    @Param('eventId') eventId: string,
    @Res() response: Response,
    @GetUserId() userId: string,
  ) {
    return this.eventService.getEventById(eventId, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENT_BY_REPETITION_ID))
  @Get('/repetition/:repetitionId')
  @ApiOperation({ summary: 'Get Event by Repetition ID' })
  @ApiOkResponse({
    description: 'Event repetition fetched successfully',
    status: 200,
  })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async getEventByRepetitionId(
    @Param('repetitionId') repetitionId: string,
    @Res() response: Response,
    @GetUserId() userId: string,
  ) {
    return this.eventService.getEventByRepetitionId(repetitionId, response);
  }
}
