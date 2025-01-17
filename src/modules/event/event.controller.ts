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
} from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SearchFilterDto } from './dto/search-event.dto';
import {
  DateValidationPipe,
  RegistrationDateValidationPipe,
  AttendeesValidationPipe,
  RecurringEndDateValidationPipe,
  SearchDateValidationPipe,
} from '../../common/pipes/event-validation.pipe';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '../../common/filters/exception.filter';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../../common/utils/constants.util';
import { checkValidUserId } from '../../common/utils/functions.util';
import { createEventsExamplesForSwagger } from './dto/create-event-example';
import { updateEventsExamplesForSwagger } from './dto/update-event-example';
import { searchEventsExamplesForSwagger } from './dto/search-event-example';

@Controller('event/v1')
@ApiTags('Create Event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
  ) {}

  @UseFilters(new AllExceptionsFilter(API_ID.CREATE_EVENT))
  @Post('/create')
  @ApiOperation({ summary: 'Create Events' })
  @ApiBody({ type: CreateEventDto, examples: createEventsExamplesForSwagger })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: ERROR_MESSAGES.USERID_REQUIRED,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @UsePipes(
    new ValidationPipe({ transform: true }),
    new DateValidationPipe(),
    new RegistrationDateValidationPipe(),
    new RecurringEndDateValidationPipe(),
    new AttendeesValidationPipe(),
  )
  @ApiCreatedResponse({
    description: SUCCESS_MESSAGES.EVENT_CREATED,
  })
  @ApiBadRequestResponse({ description: ERROR_MESSAGES.INVALID_REQUEST_BODY })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  async create(
    @Body() createEventDto: CreateEventDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    const userId: string = checkValidUserId(request.query?.userId);
    createEventDto.createdBy = userId;
    createEventDto.updatedBy = userId;
    return this.eventService.createEvent(createEventDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENTS))
  @Post('/list')
  @ApiOperation({ summary: 'Search Events' })
  @ApiBody({ type: SearchFilterDto, examples: searchEventsExamplesForSwagger })
  @ApiQuery({ name: 'userId', required: true })
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
    @Req() request: Request,
  ) {
    let userId: string;
    if (!request.query?.userId) {
      userId = null;
    } else {
      userId = checkValidUserId(request.query?.userId);
    }
    return this.eventService.getEvents(response, requestBody, userId);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.UPDATE_EVENT))
  @Patch('/:id') // eventRepetitionId
  @ApiOperation({ summary: 'Edit Events' })
  @ApiBody({ type: UpdateEventDto, examples: updateEventsExamplesForSwagger })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: ERROR_MESSAGES.USERID_REQUIRED,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_UPDATED })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  updateEvent(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true }))
    updateEventDto: UpdateEventDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    if (!updateEventDto || Object.keys(updateEventDto).length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST_BODY);
    }
    const userId: string = checkValidUserId(request.query?.userId);
    updateEventDto.updatedBy = userId;
    return this.eventService.updateEvent(id, updateEventDto, response);
  }
}
