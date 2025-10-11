import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface GhostModeState {
  enabled: boolean
  scope: 'global' | 'family'
  family_id?: string
  updated_at: Date
}

@Injectable()
export class GhostModeService {
  private readonly logger = new Logger(GhostModeService.name)
  private supabase: SupabaseClient

  constructor(private redisService: RedisService) {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  /**
   * Set global ghost mode for a user
   */
  async setGlobalGhostMode(userId: string, enabled: boolean): Promise<void> {
    this.logger.log(`Setting global ghost mode for user ${userId}: ${enabled}`)

    // Update database
    const { error } = await this.supabase.rpc('set_global_ghost_mode', {
      _enabled: enabled
    })

    if (error) {
      this.logger.error('Failed to set global ghost mode:', error)
      throw new Error('Failed to update ghost mode')
    }

    // Update Redis cache using the new cache update method
    await this.updateGhostModeCache(userId, null, enabled)

    this.logger.log(`Global ghost mode set for user ${userId}: ${enabled}`)
  }

  /**
   * Set family-specific ghost mode for a user
   */
  async setFamilyGhostMode(
    userId: string,
    familyId: string,
    enabled: boolean
  ): Promise<void> {
    this.logger.log(
      `Setting family ghost mode for user ${userId} in family ${familyId}: ${enabled}`
    )

    // Update database
    const { error } = await this.supabase.rpc('set_family_ghost_mode', {
      _family_id: familyId,
      _enabled: enabled
    })

    if (error) {
      this.logger.error('Failed to set family ghost mode:', error)
      throw new Error('Failed to update ghost mode')
    }

    // Update Redis cache using the new cache update method
    await this.updateGhostModeCache(userId, familyId, enabled)

    this.logger.log(
      `Family ghost mode set for user ${userId} in family ${familyId}: ${enabled}`
    )
  }

  /**
   * Check if a user has ghost mode enabled for a specific family
   * Returns { enabled: boolean, scope: 'global' | 'family' | null }
   */
  async isGhostModeEnabled(
    userId: string,
    familyId: string
  ): Promise<{ enabled: boolean; scope: 'global' | 'family' | null }> {
    // Check Redis cache first (global)
    const globalCache = await this.redisService.get(`ghost:global:${userId}`)
    if (globalCache === '1') {
      return { enabled: true, scope: 'global' }
    }

    // Check Redis cache (family-specific)
    const familyCache = await this.redisService.get(
      `ghost:family:${familyId}:${userId}`
    )
    if (familyCache === '1') {
      return { enabled: true, scope: 'family' }
    }

    // If not in cache, check database
    const { data, error } = await this.supabase.rpc('is_ghost_mode_enabled', {
      _user_id: userId,
      _family_id: familyId
    })

    if (error) {
      this.logger.error('Failed to check ghost mode:', error)
      return { enabled: false, scope: null }
    }

    // Cache the result
    if (data) {
      // Determine scope by checking both tables
      const { data: globalData } = await this.supabase
        .from('user_ghost_mode')
        .select('enabled')
        .eq('user_id', userId)
        .single()

      if (globalData?.enabled) {
        await this.redisService.set(
          `ghost:global:${userId}`,
          '1',
          3600 * 24 * 30
        )
        return { enabled: true, scope: 'global' }
      }

      await this.redisService.set(
        `ghost:family:${familyId}:${userId}`,
        '1',
        3600 * 24 * 30
      )
      return { enabled: true, scope: 'family' }
    }

    return { enabled: false, scope: null }
  }

  /**
   * Get all ghost mode states for a user across all families
   */
  async getUserGhostModes(userId: string): Promise<{
    global: boolean
    families: Record<string, boolean>
  }> {
    // Check global ghost mode
    const { data: globalData } = await this.supabase
      .from('user_ghost_mode')
      .select('enabled')
      .eq('user_id', userId)
      .single()

    // Get all family-specific ghost modes
    const { data: familyData } = await this.supabase
      .from('family_ghost_mode')
      .select('family_id, enabled')
      .eq('user_id', userId)

    const families: Record<string, boolean> = {}
    if (familyData) {
      familyData.forEach((entry: any) => {
        families[entry.family_id] = entry.enabled
      })
    }

    return {
      global: globalData?.enabled || false,
      families
    }
  }

  /**
   * Apply location masking based on ghost mode
   * Adds random offset to blur location (~500m-1km radius)
   */
  maskLocation(location: {
    latitude: number
    longitude: number
    accuracy?: number
  }): { latitude: number; longitude: number; accuracy: number } {
    // Blur radius: approximately 500m-1km
    const blurRadiusInDegrees = 0.005 + Math.random() * 0.005 // ~500m-1km

    const angle = Math.random() * 2 * Math.PI
    const latOffset = blurRadiusInDegrees * Math.cos(angle)
    const lonOffset = blurRadiusInDegrees * Math.sin(angle)

    return {
      latitude: location.latitude + latOffset,
      longitude: location.longitude + lonOffset,
      accuracy: 1000 // Set accuracy to 1km to indicate imprecise location
    }
  }

  /**
   * Clear ghost mode cache for a user
   */
  async clearCache(userId: string, familyId?: string): Promise<void> {
    if (familyId) {
      await this.redisService.del(`ghost:family:${familyId}:${userId}`)
      this.logger.log(
        `Cleared ghost mode cache for user ${userId} in family ${familyId}`
      )
    } else {
      await this.redisService.del(`ghost:global:${userId}`)
      this.logger.log(`Cleared global ghost mode cache for user ${userId}`)
    }
  }

  /**
   * Invalidate ghost mode cache for a user across all families
   */
  async invalidateUserGhostModeCache(userId: string): Promise<void> {
    this.logger.log(`Invalidating all ghost mode cache for user ${userId}`)

    // Clear global ghost mode
    await this.redisService.del(`ghost:global:${userId}`)

    // Get all families for this user and clear family-specific ghost modes
    const { data: familyData } = await this.supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)

    if (familyData && familyData.length > 0) {
      const deletePromises = familyData.map((entry: any) =>
        this.redisService.del(`ghost:family:${entry.family_id}:${userId}`)
      )
      await Promise.all(deletePromises)
      this.logger.log(
        `Invalidated ghost mode cache for user ${userId} in ${familyData.length} families`
      )
    }
  }

  /**
   * Invalidate ghost mode cache for all users in a family
   */
  async invalidateFamilyGhostModeCache(familyId: string): Promise<void> {
    this.logger.log(
      `Invalidating ghost mode cache for all members in family ${familyId}`
    )

    // Get all members of this family
    const { data: members } = await this.supabase
      .from('family_members')
      .select('user_id')
      .eq('family_id', familyId)

    if (members && members.length > 0) {
      const deletePromises = members.map((member: any) =>
        this.redisService.del(`ghost:family:${familyId}:${member.user_id}`)
      )
      await Promise.all(deletePromises)
      this.logger.log(
        `Invalidated ghost mode cache for ${members.length} members in family ${familyId}`
      )
    }
  }

  /**
   * Update ghost mode cache after database change
   * This ensures cache stays in sync with the database
   */
  async updateGhostModeCache(
    userId: string,
    familyId: string | null,
    enabled: boolean
  ): Promise<void> {
    const ttl = 3600 * 24 * 30 // 30 days

    if (familyId) {
      // Update family-specific cache
      await this.redisService.set(
        `ghost:family:${familyId}:${userId}`,
        enabled ? '1' : '0',
        ttl
      )
      this.logger.log(
        `Updated ghost mode cache for user ${userId} in family ${familyId}: ${enabled}`
      )
    } else {
      // Update global cache
      await this.redisService.set(
        `ghost:global:${userId}`,
        enabled ? '1' : '0',
        ttl
      )
      this.logger.log(
        `Updated global ghost mode cache for user ${userId}: ${enabled}`
      )
    }
  }

  /**
   * Refresh ghost mode cache from database
   * Useful when cache might be stale or after system restart
   */
  async refreshGhostModeCache(
    userId: string,
    familyId?: string
  ): Promise<void> {
    this.logger.log(`Refreshing ghost mode cache for user ${userId}`)

    // Refresh global ghost mode
    const { data: globalData } = await this.supabase
      .from('user_ghost_mode')
      .select('enabled')
      .eq('user_id', userId)
      .single()

    if (globalData) {
      await this.updateGhostModeCache(userId, null, globalData.enabled)
    }

    // Refresh family-specific ghost modes
    if (familyId) {
      const { data: familyData } = await this.supabase
        .from('family_ghost_mode')
        .select('enabled')
        .eq('user_id', userId)
        .eq('family_id', familyId)
        .single()

      if (familyData) {
        await this.updateGhostModeCache(userId, familyId, familyData.enabled)
      }
    } else {
      // Refresh all families
      const { data: allFamilyData } = await this.supabase
        .from('family_ghost_mode')
        .select('family_id, enabled')
        .eq('user_id', userId)

      if (allFamilyData && allFamilyData.length > 0) {
        const updatePromises = allFamilyData.map((entry: any) =>
          this.updateGhostModeCache(userId, entry.family_id, entry.enabled)
        )
        await Promise.all(updatePromises)
      }
    }

    this.logger.log(`Ghost mode cache refreshed for user ${userId}`)
  }

  /**
   * Bulk invalidate ghost mode cache for multiple users
   * Useful for family-wide operations
   */
  async bulkInvalidateGhostModeCache(
    userIds: string[],
    familyId?: string
  ): Promise<void> {
    this.logger.log(
      `Bulk invalidating ghost mode cache for ${userIds.length} users`
    )

    const deletePromises = userIds.flatMap((userId) => {
      const promises: Promise<void>[] = []

      if (familyId) {
        promises.push(
          this.redisService.del(`ghost:family:${familyId}:${userId}`)
        )
      } else {
        promises.push(this.redisService.del(`ghost:global:${userId}`))
      }

      return promises
    })

    await Promise.all(deletePromises)
    this.logger.log(
      `Bulk invalidated ghost mode cache for ${userIds.length} users`
    )
  }
}
