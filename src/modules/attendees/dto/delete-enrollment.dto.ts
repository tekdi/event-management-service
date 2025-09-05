import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteEnrollmentDto {
  @ApiProperty({
    description: 'User ID of the enrolled user',
    example: 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Event Repetition ID',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsUUID()
  @IsNotEmpty()
  eventRepetitionId: string;
}