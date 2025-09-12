import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class EnrollmentDto {
  @ApiProperty({
    description: 'Event Repetition ID',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsOptional()
  eventRepetitionId?: string;

  @ApiProperty({
    description: 'Event ID',
    example: 'bfec8878-623d-40ff-90aa-9bcaf6a73602',
  })
  @IsOptional()
  eventId?: string;

  @ApiProperty({
    description: 'User ID',
    example: 'e9fec05a-d6ab-44be-bfa4-eaeef2ef8fe9',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'User Email',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @ApiProperty({
    description: 'User First Name',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'User Last Name',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
