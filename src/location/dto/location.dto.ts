import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator'

export class LocationUpdateDto {
  @IsNumber()
  latitude: number

  @IsNumber()
  longitude: number

  @IsNumber()
  @Min(0)
  accuracy: number

  @IsNumber()
  @IsOptional()
  altitude?: number

  @IsNumber()
  @IsOptional()
  bearing?: number

  @IsNumber()
  @IsOptional()
  speed?: number

  @IsNumber()
  timestamp: number

  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel: number

  @IsString()
  batteryState: string

  @IsString()
  family_id: string
}

export class GetLocationHistoryDto {
  @IsString()
  family_id: string

  @IsNumber()
  @IsOptional()
  limit?: number

  @IsString()
  @IsOptional()
  lastId?: string
}
