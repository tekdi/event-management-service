import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { CreateEventDto } from 'src/modules/event/dto/create-event.dto';
import { ERROR_MESSAGES } from '../utils/constants.util';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { EndConditionType } from '../utils/types';
import { UpdateEventDto } from 'src/modules/event/dto/update-event.dto';

@Injectable()
export class DateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto | UpdateEventDto) {
    console.log(
      createEventDto,
      'createEventDto',
      createEventDto.startDatetime,
      createEventDto.endDatetime,
    );
    const eventStartDate = createEventDto.startDatetime.split('T')[0];
    const eventEndDate = createEventDto.endDatetime.split('T')[0];

    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const currentDate = new Date();

    console.log(
      startDate,
      'start',
      endDate,
      'end',
      currentDate,
      createEventDto.isRecurring,
    );
    if (eventStartDate !== eventEndDate && createEventDto.isRecurring) {
      throw new BadRequestException(
        ERROR_MESSAGES.MULTIDAY_EVENT_NOT_RECURRING,
      );
    }
    if (startDate <= currentDate || endDate <= currentDate) {
      throw new BadRequestException(ERROR_MESSAGES.START_DATE_INVALID);
    }
    if (endDate < startDate) {
      throw new BadRequestException(ERROR_MESSAGES.END_DATE_INVALID);
    }

    return createEventDto;
  }
}

@Injectable()
export class RegistrationDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const currentDate = new Date();
    const startDate = new Date(createEventDto.startDatetime);

    const registrationStartDate = createEventDto.registrationEndDate
      ? new Date(createEventDto.registrationStartDate)
      : null;
    const isRestricted = createEventDto.isRestricted;
    const registrationEndDate = createEventDto.registrationEndDate
      ? new Date(createEventDto.registrationEndDate)
      : null;

    // Ensure registration dates are not provided for restricted events

    if (
      (createEventDto.isRestricted && registrationStartDate) ||
      (createEventDto.isRestricted && registrationEndDate)
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RESTRICTED_EVENT_NO_REGISTRATION_DATE,
      );
    }

    // Ensure registration dates are not in the past
    if (registrationStartDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_INVALID,
      );
    }

    if (registrationEndDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_INVALID,
      );
    }

    // Validate registration dates
    if (registrationStartDate > registrationEndDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_END_DATE,
      );
    }

    // Registration period must fall between the event period
    if (registrationStartDate > startDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_EVENT_DATE,
      );
    }

    if (registrationEndDate > startDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_BEFORE_EVENT_DATE,
      );
    }

    return createEventDto;
  }
}

export class RecurringEndDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto | UpdateEventDto) {
    if (createEventDto.isRecurring) {
      const endConditionValue =
        createEventDto.recurrencePattern?.endCondition?.value;
      const endConditionType =
        createEventDto.recurrencePattern?.endCondition?.type;

      if (!endConditionType || !endConditionValue) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRING_PATTERN_REQUIRED,
        );
      }

      if (endConditionType === EndConditionType.endDate) {
        const recurrenceEndDate = new Date(endConditionValue);

        const dateValid =
          recurrenceEndDate && !Number.isNaN(recurrenceEndDate.getTime());

        if (!dateValid) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_INVALID,
          );
        }

        const startDate = new Date(createEventDto.startDatetime);
        const currentDate = new Date();
        if (recurrenceEndDate < currentDate) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_SHOULD_BE_GREATER_THAN_CURRENT_DATE,
          );
        }

        if (recurrenceEndDate <= startDate) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_END_DATE_AFTER_EVENT_DATE,
          );
        }

        if (
          endConditionValue.split('T')[1] !==
          createEventDto.endDatetime.split('T')[1]
        ) {
          throw new BadRequestException(
            'Event End time does not match with Recurrence End time',
          );
        } // do for recurrence start time also in edit
        // createEventDto.recurrencePattern.endCondition.value = endDate;
      } else if (endConditionType === EndConditionType.occurrences) {
        const occurrences = Number(endConditionValue);

        if (!occurrences || occurrences < 1) {
          throw new BadRequestException(
            ERROR_MESSAGES.RECURRENCE_OCCURRENCES_INVALID,
          );
        }
      } else if (
        endConditionType !== EndConditionType.occurrences &&
        endConditionType !== EndConditionType.endDate
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.RECURRENCE_PATTERN_INVALID,
        );
      }
    } else if (
      !createEventDto.isRecurring &&
      createEventDto instanceof CreateEventDto &&
      Object.keys(createEventDto?.recurrencePattern ?? {})?.length
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRING_PATTERN_NOT_REQUIRED,
      );
    }

    // if (createEventDto instanceof UpdateEventDto) {
    //   console.log('YESSSS');

    //   // check recurrence start date

    //   const recurringStartDateTime =
    //     createEventDto.recurrencePattern.recurringStartDate.split('T');
    //   const recurringStartDate = recurringStartDateTime[0];
    //   const recurringStartTime = recurringStartDateTime[1];

    //   // if (recurringStartDate <= currentDate) {
    //   //   throw new BadRequestException(
    //   //     'Recurring start date must be in the future 0',
    //   //   );
    //   // }

    //   // const updateEventDto = createEventDto as UpdateEventDto;
    //   // if(updateEventDto.recurrencePattern) {
    //   //   const recurrencePattern = updateEventDto.recurrencePattern;
    //   //   if(recurrencePattern.frequency === 'weekly' && recurrencePattern.weekDays.length === 0) {
    //   //     throw new BadRequestException(ERROR_MESSAGES.WEEK_DAYS_REQUIRED);
    //   //   }
    //   // }
    // }

    return createEventDto;
  }
}

@Injectable()
export class AttendeesValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const attendees = createEventDto?.attendees;

    if (!createEventDto.isRestricted) {
      if (attendees && attendees.length) {
        throw new BadRequestException(ERROR_MESSAGES.ATTENDEES_NOT_REQUIRED);
      }
    }

    return createEventDto;
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
