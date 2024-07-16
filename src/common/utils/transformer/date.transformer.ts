import { ConfigService } from '@nestjs/config';
import { getTimezoneDate } from 'src/common/utils/pipe.util';
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
  from(databaseValue: Date): Date {
    if (!databaseValue) return databaseValue;
    return getTimezoneDate(
      this.configService.get<string>('TIMEZONE'),
      new Date(databaseValue),
    );
  }
}

