import { ConfigService } from '@nestjs/config';
import { PipeTransform, Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { CreateEventDto } from 'src/modules/event/dto/create-event.dto';
import { getTimezoneCurrentDate } from '../utils/pipe.util';
import { get } from 'http';
import { ERROR_MESSAGES } from '../utils/constants.util';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
@Injectable()
export class DateValidationPipe implements PipeTransform {
  // constructor(@Inject(forwardRef(() => ConfigService)) private configService: ConfigService) { 

  // }

  transform(createEventDto: CreateEventDto) {
    const timeZone = 'Asia/Kolkata';
    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const currentDate = getTimezoneCurrentDate(timeZone) // Current date
    //  this.configService.get<string>('TIMEZONE'); // Get the timezone from the config service

    console.log('currentDate', currentDate);
    console.log('startDate', startDate);
    console.log('endDate', endDate);

    if (startDate <= currentDate) {
      throw new BadRequestException(
        'Start date must be today or a future date',
      );
    }
    if (endDate < startDate) {
      throw new BadRequestException(
        'End date should be greater than or equal to start date',
      );
    }
    return createEventDto;
  }
}

@Injectable()
export class RegistrationDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const currentDate = getTimezoneCurrentDate('Asia/Kolkata');
    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const registrationStartDate = new Date(
      createEventDto.registrationStartDate,
    );
    const registrationEndDate = new Date(createEventDto.registrationEndDate);

    // Ensure registration dates are not in the past
    if (registrationStartDate < currentDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_INVALID,
      );
    }

    if (registrationEndDate < currentDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_INVALID,
      );
    }

    // Validate registration dates
    if (registrationStartDate > registrationEndDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_END_DATE,
      );
    }

    // Registration period must fall between the event period
    console.log(registrationStartDate, "rrrrr", startDate, registrationStartDate > startDate, registrationStartDate < startDate)
    if (registrationStartDate > startDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_EVENT_DATE,
      );
    }

    if (registrationEndDate > startDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_BEFORE_EVENT_DATE,
      );
    }

    return createEventDto;
  }
}

export class RecurringEndDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const currentDate = getTimezoneCurrentDate('Asia/Kolkata');
    if (createEventDto.isRecurring) {
      const recurrenceEndDate = new Date(createEventDto.recurrenceEndDate);
      const startDate = new Date(createEventDto.startDatetime);

      if (recurrenceEndDate < currentDate) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_END_DATE_INVALID,
        );
      }

      if (recurrenceEndDate < startDate) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_END_DATE_BEFORE_EVENT_DATE,
        );
      }
    }

    return createEventDto;
  }
}

@Injectable()
export class ParamsValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    if (createEventDto.isRestricted) {
      const params = createEventDto.params;
      if (!params || typeof params !== 'object') {
        throw new BadRequestException('Invalid params object');
      }

      // if (!params.cohortIds && !params.userIds) {
      //   throw new BadRequestException(
      //     'Either cohortIds or userIds must be provided in params',
      //   );
      // }

      // if (params.cohortIds && params.userIds) {
      //   throw new BadRequestException(
      //     'Only one of cohortIds or userIds should be provided in params',
      //   );
      // }

      // if (params.cohortIds) {
      //   this.validateUUIDs(params.cohortIds);
      // } else if (params.userIds) {
      //   this.validateUUIDs(params.userIds);
      // }
    } else if (!createEventDto.isRestricted) {
      createEventDto.params = {};
    }

    return createEventDto;
  }

  private validateUUIDs(ids: string[]) {
    const uuidRegex = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i; // UUID regex pattern
    for (const id of ids) {
      if (!uuidRegex.test(id)) {
        throw new BadRequestException(`Invalid UUID format: ${id}`);
      }
    }
  }
}

@ValidatorConstraint({ name: 'endsWithZ', async: false })
export class EndsWithZConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    return typeof text === 'string' && text.endsWith('Z');
  }

  defaultMessage(args: ValidationArguments) {
    return '($value) must end with "Z"';
  }
}
