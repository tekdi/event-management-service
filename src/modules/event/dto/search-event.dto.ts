import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsDateString, IsEnum, IsString, ValidateNested } from "class-validator";

export class FilterDto {

    @ApiProperty({ example: '2024-01-01', description: 'Start date in YYYY-MM-DD format' })
    @IsOptional()
    @IsDateString()
    startDate: string;

    @ApiProperty({ example: '2024-01-01', description: 'Start date in YYYY-MM-DD format' })
    @IsOptional()
    @IsDateString()
    endDate: string;

    @ApiProperty({
        example: ['live', 'draft', 'inActive'],
        description: 'Array of status values: live, draft, inActive'
    })
    @IsOptional()
    @IsEnum(['live', 'draft', 'inActive'], { each: true, message: 'Status must be one of: live, draft, inActive' })
    status?: string[];

    @ApiProperty({
        example: ['online', 'offline', 'onlineandoffline'],
        description: 'Array of status values: online, offline, onlineandoffline'
    })
    @IsOptional()
    @IsEnum(['online', 'offline', 'onlineandoffline'], { each: true })
    eventType?: string[];

    @ApiProperty({ example: 'Event Title', description: 'Event title' })
    @IsOptional()
    @IsString()
    title?: string;

    // @ApiProperty({ example: 'John Doe', description: 'Created by user' })
    // @IsOptional()
    // @IsString()
    // createdBy?: string;
}

export class SearchFilterDto {
    @ApiProperty({ type: FilterDto, description: 'Filters for search' })
    @ValidateNested({ each: true })
    @Type(() => FilterDto)
    filters: FilterDto
}