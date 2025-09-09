import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteEventDto {
  @ApiProperty({
    type: Boolean,
    description: 'Whether to delete the main event along with the repetition',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isMainEvent?: boolean = true;
}