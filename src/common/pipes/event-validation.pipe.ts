import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { CreateEventDto } from 'src/modules/event/dto/create-event.dto';

@Injectable()
export class DateValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const currentDate = new Date(); // Current date
    // Check if start date is today or in the future
    if (startDate < currentDate) {
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
export class DeadlineValidationPipe implements PipeTransform {
  transform(createEventDto: CreateEventDto) {
    const now = new Date();
    const startDate = new Date(createEventDto.startDatetime);
    const endDate = new Date(createEventDto.endDatetime);
    const registrationStartDate = new Date(
      createEventDto.registrationStartDate,
    );
    const registrationEndDate = new Date(createEventDto.registrationEndDate);

    // Ensure registration dates are not in the past
    if (registrationStartDate < now) {
      throw new BadRequestException(
        'Registration start date must not be in the past',
      );
    }

    if (registrationEndDate < now) {
      throw new BadRequestException(
        'Registration end date must not be in the past',
      );
    }

    // Validate registration dates
    if (registrationStartDate > registrationEndDate) {
      throw new BadRequestException(
        'Registration start date must be before registration end date or same',
      );
    }

    // Registration period must fall between the event period
    if (registrationStartDate > startDate) {
      throw new BadRequestException(
        'Registration start date must be before the event start date',
      );
    }

    if (registrationEndDate > startDate) {
      throw new BadRequestException(
        'Registration end date must be on or before the event start date',
      );
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

      if (!params.cohortIds && !params.userIds) {
        throw new BadRequestException(
          'Either cohortIds or userIds must be provided in params',
        );
      }

      if (params.cohortIds && params.userIds) {
        throw new BadRequestException(
          'Only one of cohortIds or userIds should be provided in params',
        );
      }

      if (params.cohortIds) {
        this.validateUUIDs(params.cohortIds);
      } else if (params.userIds) {
        this.validateUUIDs(params.userIds);
      }
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
