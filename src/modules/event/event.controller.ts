import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  UsePipes,
  Res,
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
} from '@nestjs/swagger';
import { Response } from 'express';
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
  ) {
    return this.eventService.createEvent(createEventDto, response);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.GET_EVENTS))
  @Post('/list')
  @ApiBody({ type: SearchFilterDto })
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
    @Res() response: Response,
    @Body() requestBody: SearchFilterDto,
  ) {
    return this.eventService.getEvents(response, requestBody);
  }

  @UseFilters(new AllExceptionsFilter(API_ID.UPDATE_EVENT))
  @Patch('/:id')
  @ApiBody({ type: UpdateEventDto })
  @ApiResponse({ status: 200, description: SUCCESS_MESSAGES.EVENT_UPDATED })
  @ApiInternalServerErrorResponse({
    description: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  })
  updateEvent(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true }))
    updateEventDto: UpdateEventDto,
    @Res() response: Response,
  ) {
    if (!updateEventDto || Object.keys(updateEventDto).length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST_BODY);
    }
    return this.eventService.updateEvent(id, updateEventDto, response);
  }
}
