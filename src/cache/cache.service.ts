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
  private readonly cacheEnabled: boolean

  constructor(
    private redisService: RedisService,
    private supabaseService: SupabaseService
  ) {
    this.cacheEnabled = process.env.CACHE_ENABLED !== 'false'
    this.logger.log(`Cache ${this.cacheEnabled ? 'ENABLED' : 'DISABLED'}`)
  }

  // ==================== FAMILY MEMBERS ====================

  async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    const cacheKey = `family:${familyId}:members`

    try {
      // Try cache first (if enabled)
      if (this.cacheEnabled) {
        const cached = await this.redisService.get<FamilyMember[]>(cacheKey)
        console.log('Cached family members:', cached)
        if (cached) {
          this.logger.debug(`Cache hit for family members: ${familyId}`)
          return cached
        }
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

      // Cache the result (if enabled)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, members, this.TTL)
      }

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
   * Update family members cache after a change
   */
  async updateFamilyMembersCache(familyId: string): Promise<void> {
    this.logger.log(`Updating family members cache: ${familyId}`)

    // Invalidate first
    await this.invalidateFamilyMembers(familyId)

    // Fetch fresh data which will automatically cache it
    await this.getFamilyMembers(familyId)

    this.logger.log(`Family members cache updated: ${familyId}`)
  }

  /**
   * Get all family IDs that a user belongs to
   */
  async getUserFamilyIds(userId: string): Promise<string[]> {
    const cacheKey = `user:${userId}:families`

    try {
      // Try cache first (if enabled)
      if (this.cacheEnabled) {
        const cached = await this.redisService.get<string[]>(cacheKey)
        if (cached) {
          this.logger.debug(`Cache hit for user families: ${userId}`)
          return cached
        }
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

      // Cache the result (1 hour TTL) (if enabled)
      if (this.cacheEnabled && familyIds.length > 0) {
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

  /**
   * Update user families cache after a change
   */
  async updateUserFamiliesCache(userId: string): Promise<void> {
    this.logger.log(`Updating user families cache: ${userId}`)

    // Invalidate first
    await this.invalidateUserFamilies(userId)

    // Fetch fresh data which will automatically cache it
    await this.getUserFamilyIds(userId)

    this.logger.log(`User families cache updated: ${userId}`)
  }

  // ==================== GEOFENCES ====================

  async getGeofences(familyId: string): Promise<Geofence[]> {
    const cacheKey = `geofence:${familyId}`

    try {
      // Try cache first (if enabled)
      if (this.cacheEnabled) {
        const cached = await this.redisService.get<Geofence[]>(cacheKey)
        if (cached) {
          this.logger.debug(`Cache hit for geofences: ${familyId}`)
          return cached
        }
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

      // Cache the result (if enabled)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, geofences, this.TTL)
      }

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

  /**
   * Update geofences cache after a change
   */
  async updateGeofencesCache(familyId: string): Promise<void> {
    this.logger.log(`Updating geofences cache: ${familyId}`)

    // Invalidate first
    await this.invalidateGeofences(familyId)

    // Fetch fresh data which will automatically cache it
    await this.getGeofences(familyId)

    this.logger.log(`Geofences cache updated: ${familyId}`)
  }

  // ==================== LOCATIONS ====================

  async getLastLocation(
    userId: string,
    familyId: string
  ): Promise<LocationCache | null> {
    const cacheKey = `user:${userId}:family:${familyId}:last_location`

    try {
      if (this.cacheEnabled) {
        const cached = await this.redisService.get<LocationCache>(cacheKey)
        if (cached) {
          return cached
        }
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

        // Cache it (if enabled)
        if (this.cacheEnabled) {
          await this.redisService.set(cacheKey, location, 300) // 5 min TTL
        }
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
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, location, 300) // 5 min TTL
      }
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
      // Try cache first (if enabled)
      if (this.cacheEnabled) {
        const cached = await this.redisService.get<string>(cacheKey)
        if (cached) {
          return cached
        }
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

      // Cache the role (if enabled)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, data.role, this.TTL)
      }

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

  /**
   * Update user role cache after a change
   */
  async updateUserRoleCache(userId: string, familyId: string): Promise<void> {
    this.logger.log(`Updating user role cache: ${userId} in ${familyId}`)

    // Invalidate first
    await this.invalidateUserRole(userId, familyId)

    // Fetch fresh data which will automatically cache it
    await this.getUserRole(userId, familyId)

    this.logger.log(`User role cache updated: ${userId} in ${familyId}`)
  }

  // ==================== COMPREHENSIVE INVALIDATION ====================

  /**
   * Invalidate all cache entries for a specific family
   * Use this when a family is deleted or major changes occur
   */
  async invalidateAllFamilyCache(familyId: string): Promise<void> {
    this.logger.log(`Invalidating all cache for family: ${familyId}`)

    const deletePromises: Promise<void>[] = [
      this.invalidateFamilyMembers(familyId),
      this.invalidateGeofences(familyId)
    ]

    // Get all members to invalidate their roles and locations
    try {
      const members = await this.getFamilyMembers(familyId)

      members.forEach((member) => {
        deletePromises.push(this.invalidateUserRole(member.user_id, familyId))
        deletePromises.push(
          this.redisService.del(
            `user:${member.user_id}:family:${familyId}:last_location`
          )
        )
        deletePromises.push(
          this.redisService.del(
            `user:${member.user_id}:family:${familyId}:online`
          )
        )
      })
    } catch (error) {
      this.logger.error(`Error getting members for cache invalidation:`, error)
    }

    await Promise.all(deletePromises)
    this.logger.log(`All cache invalidated for family: ${familyId}`)
  }

  /**
   * Invalidate all cache entries for a specific user
   * Use this when a user is deleted or leaves all families
   */
  async invalidateAllUserCache(userId: string): Promise<void> {
    this.logger.log(`Invalidating all cache for user: ${userId}`)

    const deletePromises: Promise<void>[] = [
      this.invalidateUserFamilies(userId)
    ]

    // Get all families to invalidate user's data in each family
    try {
      const familyIds = await this.getUserFamilyIds(userId)

      familyIds.forEach((familyId) => {
        deletePromises.push(this.invalidateUserRole(userId, familyId))
        deletePromises.push(
          this.redisService.del(
            `user:${userId}:family:${familyId}:last_location`
          )
        )
        deletePromises.push(
          this.redisService.del(`user:${userId}:family:${familyId}:online`)
        )
      })
    } catch (error) {
      this.logger.error(`Error getting families for cache invalidation:`, error)
    }

    await Promise.all(deletePromises)
    this.logger.log(`All cache invalidated for user: ${userId}`)
  }

  /**
   * Invalidate cache when a user joins a family
   */
  async invalidateCacheOnUserJoin(
    userId: string,
    familyId: string
  ): Promise<void> {
    this.logger.log(
      `Invalidating cache for user ${userId} joining family ${familyId}`
    )

    await Promise.all([
      this.invalidateUserFamilies(userId),
      this.invalidateFamilyMembers(familyId)
    ])

    this.logger.log(`Cache invalidated for user join event`)
  }

  /**
   * Invalidate cache when a user leaves a family
   */
  async invalidateCacheOnUserLeave(
    userId: string,
    familyId: string
  ): Promise<void> {
    this.logger.log(
      `Invalidating cache for user ${userId} leaving family ${familyId}`
    )

    await Promise.all([
      this.invalidateUserFamilies(userId),
      this.invalidateFamilyMembers(familyId),
      this.invalidateUserRole(userId, familyId),
      this.redisService.del(`user:${userId}:family:${familyId}:last_location`),
      this.redisService.del(`user:${userId}:family:${familyId}:online`)
    ])

    this.logger.log(`Cache invalidated for user leave event`)
  }

  /**
   * Update all cache for a family (refresh from database)
   */
  async updateAllFamilyCache(familyId: string): Promise<void> {
    this.logger.log(`Updating all cache for family: ${familyId}`)

    await Promise.all([
      this.updateFamilyMembersCache(familyId),
      this.updateGeofencesCache(familyId)
    ])

    this.logger.log(`All cache updated for family: ${familyId}`)
  }

  /**
   * Invalidate location cache for a user in a family
   */
  async invalidateUserLocation(
    userId: string,
    familyId: string
  ): Promise<void> {
    const cacheKey = `user:${userId}:family:${familyId}:last_location`
    await this.redisService.del(cacheKey)
    this.logger.log(
      `Invalidated location cache for user ${userId} in family ${familyId}`
    )
  }

  /**
   * Invalidate location cache for all members in a family
   */
  async invalidateAllFamilyLocations(familyId: string): Promise<void> {
    this.logger.log(`Invalidating all location cache for family: ${familyId}`)

    try {
      const members = await this.getFamilyMembers(familyId)

      const deletePromises = members.map((member) =>
        this.redisService.del(
          `user:${member.user_id}:family:${familyId}:last_location`
        )
      )

      await Promise.all(deletePromises)
      this.logger.log(
        `Invalidated location cache for ${members.length} members in family ${familyId}`
      )
    } catch (error) {
      this.logger.error(`Error invalidating family locations:`, error)
    }
  }

  // ==================== ONLINE STATUS ====================

  async setOnlineStatus(
    userId: string,
    familyId: string,
    isOnline: boolean
  ): Promise<void> {
    const cacheKey = `user:${userId}:family:${familyId}:online`

    try {
      if (this.cacheEnabled) {
        if (isOnline) {
          await this.redisService.set(
            cacheKey,
            { online: true, timestamp: Date.now() },
            120
          ) // 2 min TTL
        } else {
          await this.redisService.del(cacheKey)
        }
      }
    } catch (error) {
      this.logger.error(`Error setting online status:`, error)
    }
  }

  async getOnlineStatus(userId: string, familyId: string): Promise<boolean> {
    const cacheKey = `user:${userId}:family:${familyId}:online`

    try {
      if (this.cacheEnabled) {
        const status = await this.redisService.get(cacheKey)
        return status !== null
      }
      return false
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
