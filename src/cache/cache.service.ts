import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { SupabaseService } from '../supabase/supabase.service'

interface FamilyMember {
  user_id: string
  family_id: string
  role: string
  name: string
  avatar_url?: string
  joined_at: string
}

interface Geofence {
  id: string
  family_id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  enabled: boolean
}

interface LocationCache {
  user_id: string
  family_id: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  batteryLevel: number
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)
  private readonly TTL = 3600 // 1 hour

  constructor(
    private redisService: RedisService,
    private supabaseService: SupabaseService
  ) {}

  // ==================== FAMILY MEMBERS ====================

  async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    const cacheKey = `family:${familyId}:members`

    try {
      // Try cache first
      const cached = await this.redisService.get<FamilyMember[]>(cacheKey)
      if (cached) {
        this.logger.debug(`Cache hit for family members: ${familyId}`)
        return cached
      }

      // Cache miss - fetch from database using admin client (bypasses RLS)
      this.logger.debug(`Cache miss for family members: ${familyId}`)
      const supabase = this.supabaseService.getAdminClient()

      if (!supabase) {
        this.logger.warn('Supabase admin client not available')
        return []
      }

      const { data, error } = await supabase
        .from('family_members')
        .select(
          `
          user_id,
          family_id,
          role,
          users:user_id (
            name,
            avatar_url
          ),
          joined_at
        `
        )
        .eq('family_id', familyId)

      if (error) {
        this.logger.error(`Failed to fetch family members from DB:`, error)
        return []
      }

      const members: FamilyMember[] = (data || []).map((item: any) => ({
        user_id: item.user_id,
        family_id: item.family_id,
        role: item.role,
        name: item.users?.name || 'Unknown',
        avatar_url: item.users?.avatar_url,
        joined_at: item.joined_at
      }))

      // Cache the result
      await this.redisService.set(cacheKey, members, this.TTL)

      return members
    } catch (error) {
      this.logger.error(`Error getting family members for ${familyId}:`, error)
      return []
    }
  }

  async invalidateFamilyMembers(familyId: string): Promise<void> {
    const cacheKey = `family:${familyId}:members`
    await this.redisService.del(cacheKey)
    this.logger.log(`Invalidated family members cache: ${familyId}`)
  }

  /**
   * Get all family IDs that a user belongs to
   */
  async getUserFamilyIds(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:families`

    try {
      // Try cache first
      const cached = await this.redisService.get<string[]>(cacheKey)
      if (cached) {
        this.logger.debug(`Cache hit for user families: ${userId}`)
        return cached
      }

      // Cache miss - fetch from database using admin client (bypasses RLS)
      this.logger.debug(`Cache miss for user families: ${userId}`)
      const supabase = this.supabaseService.getAdminClient()

      if (!supabase) {
        this.logger.warn('Supabase admin client not available')
        return []
      }

      this.logger.log(`Querying family_members for user_id: ${userId}`)

      const { data, error } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)

      this.logger.log(
        `Query result - Data: ${JSON.stringify(data)}, Error: ${JSON.stringify(error)}`
      )

      if (error) {
        this.logger.error(`Failed to fetch user families from DB:`, error)
        return []
      }

      const familyIds = (data || []).map((item: any) => item.family_id)
      this.logger.log(
        `Found ${familyIds.length} families for user ${userId}: ${familyIds.join(', ')}`
      )

      // Cache the result (1 hour TTL)
      if (familyIds.length > 0) {
        await this.redisService.set(cacheKey, familyIds, this.TTL)
      }

      return familyIds
    } catch (error) {
      this.logger.error(`Error getting families for user ${userId}:`, error)
      return []
    }
  }

  async invalidateUserFamilies(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:families`
    await this.redisService.del(cacheKey)
    this.logger.log(`Invalidated user families cache: ${userId}`)
  }

  // ==================== GEOFENCES ====================

  async getGeofences(familyId: string): Promise<Geofence[]> {
    const cacheKey = `geofence:${familyId}`

    try {
      // Try cache first
      const cached = await this.redisService.get<Geofence[]>(cacheKey)
      if (cached) {
        this.logger.debug(`Cache hit for geofences: ${familyId}`)
        return cached
      }

      // Cache miss - fetch from database using admin client (bypasses RLS)
      this.logger.debug(`Cache miss for geofences: ${familyId}`)
      const supabase = this.supabaseService.getAdminClient()

      if (!supabase) {
        this.logger.warn('Supabase admin client not available')
        return []
      }

      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('family_id', familyId)
        .eq('enabled', true)

      if (error) {
        this.logger.error(`Failed to fetch geofences from DB:`, error)
        return []
      }

      const geofences: Geofence[] = data || []

      // Cache the result
      await this.redisService.set(cacheKey, geofences, this.TTL)

      return geofences
    } catch (error) {
      this.logger.error(`Error getting geofences for ${familyId}:`, error)
      return []
    }
  }

  async invalidateGeofences(familyId: string): Promise<void> {
    const cacheKey = `geofence:${familyId}`
    await this.redisService.del(cacheKey)
    this.logger.log(`Invalidated geofences cache: ${familyId}`)
  }

  // ==================== LOCATIONS ====================

  async getLastLocation(
    userId: string,
    familyId: string
  ): Promise<LocationCache | null> {
    const cacheKey = `user:${userId}:family:${familyId}:last_location`

    try {
      const cached = await this.redisService.get<LocationCache>(cacheKey)
      if (cached) {
        return cached
      }

      // Try to get from stream
      const streamKey = `locations:family:${familyId}`
      const messages = await this.redisService.readStream(streamKey, 100)

      // Find the last message for this user
      const userMessages = messages.filter((msg) => msg.user_id === userId)
      if (userMessages.length > 0) {
        const lastMessage = userMessages[userMessages.length - 1]
        const location: LocationCache = {
          user_id: lastMessage.user_id,
          family_id: lastMessage.family_id,
          latitude: parseFloat(lastMessage.latitude),
          longitude: parseFloat(lastMessage.longitude),
          accuracy: parseFloat(lastMessage.accuracy),
          timestamp: parseInt(lastMessage.timestamp),
          batteryLevel: parseInt(lastMessage.batteryLevel || '100')
        }

        // Cache it
        await this.redisService.set(cacheKey, location, 300) // 5 min TTL
        return location
      }

      return null
    } catch (error) {
      this.logger.error(`Error getting last location for ${userId}:`, error)
      return null
    }
  }

  async setLastLocation(location: LocationCache): Promise<void> {
    const cacheKey = `user:${location.user_id}:family:${location.family_id}:last_location`

    try {
      await this.redisService.set(cacheKey, location, 300) // 5 min TTL
    } catch (error) {
      this.logger.error(
        `Error caching location for ${location.user_id}:`,
        error
      )
    }
  }

  async getAllFamilyLocations(familyId: string): Promise<LocationCache[]> {
    try {
      const members = await this.getFamilyMembers(familyId)
      const locations: LocationCache[] = []

      for (const member of members) {
        const location = await this.getLastLocation(member.user_id, familyId)
        if (location) {
          locations.push(location)
        }
      }

      return locations
    } catch (error) {
      this.logger.error(
        `Error getting all family locations for ${familyId}:`,
        error
      )
      return []
    }
  }

  // ==================== USER ROLES ====================

  async getUserRole(userId: string, familyId: string): Promise<string | null> {
    const cacheKey = `user:${userId}:family:${familyId}:role`

    try {
      // Try cache first
      const cached = await this.redisService.get<string>(cacheKey)
      if (cached) {
        return cached
      }

      // Fetch from database
      const supabase = this.supabaseService.getClient()

      if (!supabase) {
        return null
      }

      const { data, error } = await supabase
        .from('family_members')
        .select('role')
        .eq('user_id', userId)
        .eq('family_id', familyId)
        .single()

      if (error || !data) {
        return null
      }

      // Cache the role
      await this.redisService.set(cacheKey, data.role, this.TTL)

      return data.role
    } catch (error) {
      this.logger.error(`Error getting user role:`, error)
      return null
    }
  }

  async invalidateUserRole(userId: string, familyId: string): Promise<void> {
    const cacheKey = `user:${userId}:family:${familyId}:role`
    await this.redisService.del(cacheKey)
    this.logger.log(`Invalidated user role cache: ${userId} in ${familyId}`)
  }

  // ==================== ONLINE STATUS ====================

  async setOnlineStatus(
    userId: string,
    familyId: string,
    isOnline: boolean
  ): Promise<void> {
    const cacheKey = `user:${userId}:family:${familyId}:online`

    try {
      if (isOnline) {
        await this.redisService.set(
          cacheKey,
          { online: true, timestamp: Date.now() },
          120
        ) // 2 min TTL
      } else {
        await this.redisService.del(cacheKey)
      }
    } catch (error) {
      this.logger.error(`Error setting online status:`, error)
    }
  }

  async getOnlineStatus(userId: string, familyId: string): Promise<boolean> {
    const cacheKey = `user:${userId}:family:${familyId}:online`

    try {
      const status = await this.redisService.get(cacheKey)
      return status !== null
    } catch (error) {
      return false
    }
  }

  async getOnlineMembers(familyId: string): Promise<string[]> {
    try {
      const members = await this.getFamilyMembers(familyId)
      const onlineMembers: string[] = []

      for (const member of members) {
        const isOnline = await this.getOnlineStatus(member.user_id, familyId)
        if (isOnline) {
          onlineMembers.push(member.user_id)
        }
      }

      return onlineMembers
    } catch (error) {
      this.logger.error(`Error getting online members:`, error)
      return []
    }
  }
}
