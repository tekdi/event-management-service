import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  Res,
  ValidationPipe,
  BadRequestException,
  ParseUUIDPipe,
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
} from '@nestjs/swagger';
import { Response } from 'express';
import { SearchFilterDto } from './dto/search-event.dto';
import {
  DateValidationPipe,
  RegistrationDateValidationPipe,
  AttendeesValidationPipe,
  RecurringEndDateValidationPipe,
} from 'src/common/pipes/event-validation.pipe';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from 'src/common/filters/exception.filter';
import {
  API_ID,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from 'src/common/utils/constants.util';

@Controller('event/v1')
@ApiTags('Create Event')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
  ) {}

  @UseFilters(new AllExceptionsFilter(API_ID.CREATE_EVENT))
  @Post('/create')
  @ApiBody({ type: CreateEventDto })
  @UsePipes(
    new ValidationPipe({ transform: true }),
    new DateValidationPipe(new ConfigService()),
    new RegistrationDateValidationPipe(new ConfigService()),
    new RecurringEndDateValidationPipe(new ConfigService()),
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
  ) {
    const userId = '016badad-22b0-4566-88e9-aab1b35b1dfc'; // later come from JWT-token
    this.configService;
    console.log('createEventDtocontr', createEventDto);
    return this.eventService.createEvent(createEventDto, userId, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENTS))
  @Post('/list')
  @ApiBody({ type: SearchFilterDto })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOkResponse({
    description: 'Searched',
    status: 200,
  })
  async findAll(
    @Res() response: Response,
    @Body() requestBody: SearchFilterDto,
  ) {
    return this.eventService.getEvents(response, requestBody);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENT_BY_ID))
  @Get('/:id')
  @ApiOkResponse({
    description: 'Get event details by id',
    status: 200,
  })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    // return this.eventService.getEventByID(id, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.UPDATE_EVENT))
  @Patch('/:id')
  @ApiBody({ type: UpdateEventDto })
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_UPDATED })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  @UsePipes(new ValidationPipe({ transform: true }))
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Res() response: Response,
  ) {
    if (!updateEventDto || Object.keys(updateEventDto).length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST_BODY);
    }
    const userId = '01455719-e84f-4bc8-8efa-7024874ade08'; // later come from JWT-token
    // return this.eventService.updateEvent(id, updateEventDto, userId, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.DELETE_EVENT))
  @Delete('/:id')
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_DELETED })
  @ApiResponse({ status: 404, description: SUCCESS_MESSAGES.EVENT_NOT_FOUND })
  deleteEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    // return this.eventService.deleteEvent(id, response);
  }
}
