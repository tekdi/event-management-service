import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BulkImportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'XLSX file to import',
  })
  file: any;

  @ApiProperty({ description: 'Event ID' })
  @IsNotEmpty()
  @IsString()
  eventId: string;

  @ApiPropertyOptional({ description: 'Cohort ID' })
  @IsOptional()
  @IsString()
  cohortId?: string;

  @ApiPropertyOptional({ description: 'Lesson ID' })
  @IsOptional()
  @IsString()
  lessonId?: string;

  @ApiPropertyOptional({ description: 'Course ID' })
  @IsOptional()
  @IsString()
  courseId?: string;
}
