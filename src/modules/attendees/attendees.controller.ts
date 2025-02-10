import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  Res,
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
  async searchAttendees(
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
}
