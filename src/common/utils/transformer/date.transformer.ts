import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTimezoneDateString } from 'src/common/utils/pipe.util';
import { ValueTransformer } from 'typeorm';

export class TimeZoneTransformer implements ValueTransformer {
  // private timeZone: string;

  constructor(private configService: ConfigService) {}

  // To DB: Convert the date to UTC before saving
  to(entityValue: Date): Date {
    // if (!entityValue) return entityValue;
    return entityValue;
  }

  // From DB: Convert the date from UTC to the desired time zone after fetching
  from(databaseValue: Date): string {
    if (!databaseValue) return databaseValue.toISOString();
    if (
      !(
        this.configService.get<number>('TIMEZONE_OFFSET') &&
        this.configService.get<string>('TIMEZONE') &&
        this.configService.get<string>('TIMEZONE_OFFSET_STRING')
      )
    ) {
      const errmsg =
        'TIMEZONE_OFFSET, TIMEZONE and TIMEZONE_OFFSET_STRING unavailable';
      throw new BadRequestException(errmsg);
    }
    return getTimezoneDateString(
      this.configService.get<number>('TIMEZONE_OFFSET'),
      this.configService.get<string>('TIMEZONE'),
      this.configService.get<string>('TIMEZONE_OFFSET_STRING'),
      databaseValue,
    );
  }
}
