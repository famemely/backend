import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { CacheService } from '../cache/cache.service'
import { LocationUpdateDto } from './dto/location.dto'

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name)

  constructor(
    private redisService: RedisService,
    private cacheService: CacheService
  ) {}

  /**
   * Process location update from mobile client
   */
  async processLocationUpdate(userId: string, locationDto: LocationUpdateDto) {
    const { family_id, ...locationData } = locationDto

    try {
      // 1. Add to Redis Stream for durability
      const streamKey = `locations:family:${family_id}`
      const messageId = await this.redisService.addToStream(streamKey, {
        user_id: userId,
        family_id,
        ...locationData,
        server_timestamp: Date.now()
      })

      this.logger.debug(`Location added to stream: ${messageId}`)

      // 2. Update cache
      await this.cacheService.setLastLocation({
        user_id: userId,
        family_id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp,
        batteryLevel: locationData.batteryLevel
      })

      // 3. Publish to Pub/Sub for real-time broadcast
      const broadcastChannel = `family:${family_id}:location`
      await this.redisService.publish(broadcastChannel, {
        type: 'location_update',
        user_id: userId,
        family_id,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp,
        batteryLevel: locationData.batteryLevel
      })

      this.logger.log(
        `Location update processed for user ${userId} in family ${family_id}`
      )

      return {
        success: true,
        message_id: messageId,
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error(`Failed to process location update:`, error)
      throw error
    }
  }

  /**
   * Get location history from Redis Streams
   */
  async getLocationHistory(
    familyId: string,
    userId?: string,
    limit: number = 100,
    lastId: string = '-'
  ) {
    try {
      const streamKey = `locations:family:${familyId}`
      const messages = await this.redisService.readStream(
        streamKey,
        limit,
        lastId
      )

      // Filter by user if specified
      let filteredMessages = messages
      if (userId) {
        filteredMessages = messages.filter((msg) => msg.user_id === userId)
      }

      return {
        locations: filteredMessages.map((msg) => ({
          id: msg.id,
          user_id: msg.user_id,
          latitude: parseFloat(msg.latitude),
          longitude: parseFloat(msg.longitude),
          accuracy: parseFloat(msg.accuracy),
          timestamp: parseInt(msg.timestamp),
          batteryLevel: parseInt(msg.batteryLevel || '100'),
          server_timestamp: parseInt(msg.server_timestamp)
        })),
        lastId:
          filteredMessages.length > 0
            ? filteredMessages[filteredMessages.length - 1].id
            : lastId
      }
    } catch (error) {
      this.logger.error(`Failed to get location history:`, error)
      throw error
    }
  }

  /**
   * Get current locations of all family members
   */
  async getAllFamilyLocations(familyId: string) {
    try {
      const locations = await this.cacheService.getAllFamilyLocations(familyId)

      return {
        family_id: familyId,
        locations: locations.map((loc) => ({
          user_id: loc.user_id,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          timestamp: loc.timestamp,
          batteryLevel: loc.batteryLevel
        })),
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error(`Failed to get all family locations:`, error)
      throw error
    }
  }

  /**
   * Get specific user's last location
   */
  async getUserLocation(userId: string, familyId: string) {
    try {
      const location = await this.cacheService.getLastLocation(userId, familyId)

      if (!location) {
        return null
      }

      return {
        user_id: location.user_id,
        family_id: location.family_id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        batteryLevel: location.batteryLevel
      }
    } catch (error) {
      this.logger.error(`Failed to get user location:`, error)
      throw error
    }
  }
}
