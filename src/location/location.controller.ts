import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param
} from '@nestjs/common'
import { LocationService } from './location.service'
import { LocationUpdateDto, GetLocationHistoryDto } from './dto/location.dto'

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /**
   * POST /location/update
   * Update user's location
   */
  @Post('update')
  @HttpCode(HttpStatus.OK)
  async updateLocation(
    @Body() locationDto: LocationUpdateDto,
    @Request() req: any
  ) {
    const userId = req.user?.sub || req.user?.userId || 'anonymous'
    return this.locationService.processLocationUpdate(userId, locationDto)
  }

  /**
   * GET /location/family/:familyId
   * Get all current locations for family members
   */
  @Get('family/:familyId')
  async getFamilyLocations(@Param('familyId') familyId: string) {
    return this.locationService.getAllFamilyLocations(familyId)
  }

  /**
   * GET /location/history
   * Get location history from stream
   */
  @Get('history')
  async getLocationHistory(
    @Query('family_id') familyId: string,
    @Query('user_id') userId?: string,
    @Query('limit') limit?: string,
    @Query('lastId') lastId?: string
  ) {
    const limitNum = limit ? parseInt(limit) : 100
    return this.locationService.getLocationHistory(
      familyId,
      userId,
      limitNum,
      lastId || '-'
    )
  }

  /**
   * GET /location/user/:userId/family/:familyId
   * Get specific user's last location
   */
  @Get('user/:userId/family/:familyId')
  async getUserLocation(
    @Param('userId') userId: string,
    @Param('familyId') familyId: string
  ) {
    return this.locationService.getUserLocation(userId, familyId)
  }
}
