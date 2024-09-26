import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
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
    const eventStartDate = createEventDto.startDatetime.split('T')[0];
    const eventEndDate = createEventDto.endDatetime.split('T')[0];

    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const currentDate = new Date();

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

    this.validateRestrictedEventDates(
      createEventDto,
      registrationStartDate,
      registrationEndDate,
    );
    this.validateRegistrationDatesNotInPast(
      registrationStartDate,
      registrationEndDate,
      currentDate,
      isRestricted,
    );
    this.validateRegistrationDatesOrder(
      registrationStartDate,
      registrationEndDate,
      isRestricted,
    );
    this.validateRegistrationPeriodWithinEventPeriod(
      registrationStartDate,
      registrationEndDate,
      startDate,
      isRestricted,
    );

    return createEventDto;
  }

  private validateRestrictedEventDates(
    createEventDto: CreateEventDto,
    registrationStartDate: Date | null,
    registrationEndDate: Date | null,
  ) {
    if (
      (createEventDto.isRestricted && registrationStartDate) ||
      (createEventDto.isRestricted && registrationEndDate)
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RESTRICTED_EVENT_NO_REGISTRATION_DATE,
      );
    }
  }

  private validateRegistrationDatesNotInPast(
    registrationStartDate: Date | null,
    registrationEndDate: Date | null,
    currentDate: Date,
    isRestricted: boolean,
  ) {
    if (registrationStartDate && registrationStartDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_INVALID,
      );
    }

    if (registrationEndDate && registrationEndDate < currentDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_END_DATE_INVALID,
      );
    }
  }

  private validateRegistrationDatesOrder(
    registrationStartDate: Date | null,
    registrationEndDate: Date | null,
    isRestricted: boolean,
  ) {
    if (registrationStartDate > registrationEndDate && !isRestricted) {
      throw new BadRequestException(
        ERROR_MESSAGES.REGISTRATION_START_DATE_BEFORE_END_DATE,
      );
    }
  }

  private validateRegistrationPeriodWithinEventPeriod(
    registrationStartDate: Date | null,
    registrationEndDate: Date | null,
    startDate: Date,
    isRestricted: boolean,
  ) {
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
  }
}

export class RecurringEndDateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto | UpdateEventDto) {
    if (createEventDto.isRecurring) {
      this.validateRecurringEvent(createEventDto);
    } else if (
      !createEventDto.isRecurring &&
      Object.keys(createEventDto?.recurrencePattern ?? {})?.length
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRING_PATTERN_NOT_REQUIRED,
      );
    }

    return createEventDto;
  }

  private validateRecurringEvent(
    createEventDto: CreateEventDto | UpdateEventDto,
  ) {
    const endConditionValue =
      createEventDto.recurrencePattern?.endCondition?.value;
    const endConditionType =
      createEventDto.recurrencePattern?.endCondition?.type;
    const recurringStartDate =
      createEventDto.recurrencePattern.recurringStartDate;

    if (!endConditionType || !endConditionValue) {
      throw new BadRequestException(ERROR_MESSAGES.RECURRING_PATTERN_REQUIRED);
    }

    if (endConditionType === EndConditionType.endDate) {
      this.validateEndDateCondition(
        createEventDto,
        endConditionValue,
        recurringStartDate,
      );
    } else if (endConditionType === EndConditionType.occurrences) {
      this.validateOccurrencesCondition(endConditionValue);
    } else {
      throw new BadRequestException(ERROR_MESSAGES.RECURRENCE_PATTERN_INVALID);
    }
  }

  private validateEndDateCondition(
    createEventDto: CreateEventDto | UpdateEventDto,
    endConditionValue: string,
    recurringStartDate: string,
  ) {
    const recurrenceEndDate = new Date(endConditionValue);

    const dateValid =
      recurrenceEndDate && !Number.isNaN(recurrenceEndDate.getTime());

    if (!dateValid) {
      throw new BadRequestException(ERROR_MESSAGES.RECURRENCE_END_DATE_INVALID);
    }

    const currentDate = new Date();
    if (recurrenceEndDate < currentDate) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRENCE_END_DATE_SHOULD_BE_GREATER_THAN_CURRENT_DATE,
      );
    }

    if (
      recurrenceEndDate <= new Date(createEventDto.startDatetime) &&
      createEventDto instanceof CreateEventDto
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRENCE_END_DATE_AFTER_EVENT_DATE,
      );
    }

    this.validateEndDateTime(
      createEventDto,
      endConditionValue,
      recurringStartDate,
    );
  }

  private validateEndDateTime(
    createEventDto: CreateEventDto | UpdateEventDto,
    endConditionValue: string,
    recurringStartDate: string,
  ) {
    const endDateTime = endConditionValue.split('T');
    const endDate = endDateTime[0]; // recurring end date
    const startDateTime = recurringStartDate.split('T');
    const startDate = startDateTime[0];

    if (
      new Date(endConditionValue).getTime() !==
      new Date(
        endDate + 'T' + createEventDto.endDatetime.split('T')[1],
      ).getTime() // compare with current event end time
    ) {
      throw new BadRequestException(ERROR_MESSAGES.ENDTIME_DOES_NOT_MATCH);
    }

    if (
      new Date(recurringStartDate).getTime() !==
      new Date(
        startDate + 'T' + createEventDto.startDatetime.split('T')[1],
      ).getTime()
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.EVENT_START_TIME_DOES_NOT_MATCH,
      );
    }
  }

  private validateOccurrencesCondition(endConditionValue: string) {
    const occurrences = Number(endConditionValue);

    if (!Number.isInteger(occurrences) || occurrences < 1) {
      throw new BadRequestException(
        ERROR_MESSAGES.RECURRENCE_OCCURRENCES_INVALID,
      );
    }
  }
}

@Injectable()
export class AttendeesValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const attendees = createEventDto?.attendees;

    if (!createEventDto.isRestricted) {
      if (attendees?.length) {
        throw new BadRequestException(ERROR_MESSAGES.ATTENDEES_NOT_REQUIRED);
      }
    }

    return createEventDto;
  }
}

@Injectable()
export class SearchDateValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    const { date, startDate, endDate } = value.filters || {};

    this.checkDateConflicts(date, startDate, endDate);
    this.checkDateFields(date, startDate, endDate);
    this.checkDateOrder(date, startDate, endDate);

    return value;
  }

  private checkDateConflicts(date: any, startDate: any, endDate: any) {
    if (date && (startDate || endDate)) {
      throw new BadRequestException(ERROR_MESSAGES.ONLY_ONE_DATE_ALLOWED);
    }
  }

  private checkDateFields(date: any, startDate: any, endDate: any) {
    if (date && (!date.after || !date.before)) {
      throw new BadRequestException(
        ERROR_MESSAGES.BOTH_AFTER_AND_BEFORE_REQUIRED,
      );
    }

    if (
      startDate &&
      (!startDate.after || !startDate.before) &&
      endDate === undefined
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.BOTH_AFTER_AND_BEFORE_REQUIRED_FOR_STARTDATE,
      );
    }

    if (
      endDate &&
      (!endDate.after || !endDate.before) &&
      startDate === undefined
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.BOTH_AFTER_AND_BEFORE_REQUIRED_FOR_ENDDATE,
      );
    }

    if (startDate && endDate && (!startDate.after || !endDate.before)) {
      throw new BadRequestException(
        ERROR_MESSAGES.AFTER_IN_START_AND_BEFORE_IN_END,
      );
    }
  }

  private checkDateOrder(date: any, startDate: any, endDate: any) {
    if (
      (date && new Date(date.after) > new Date(date.before)) ||
      (startDate &&
        !endDate &&
        new Date(startDate.after) > new Date(startDate.before)) ||
      (endDate &&
        !startDate &&
        new Date(endDate.after) > new Date(endDate.before)) ||
      (startDate &&
        endDate &&
        new Date(startDate.after) > new Date(endDate.before))
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.AFTER_SHOULD_BE_LESS_THAN_BEFORE,
      );
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
