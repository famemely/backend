/**
 * Cache Invalidation Examples
 *
 * This file demonstrates how to use the cache invalidation mechanisms
 * in various scenarios throughout the application.
 */

import { Injectable, Logger } from '@nestjs/common'
import { CacheService } from '../cache/cache.service'
import { GhostModeService } from '../ghost-mode/ghost-mode.service'

@Injectable()
export class CacheInvalidationExamples {
  private readonly logger = new Logger(CacheInvalidationExamples.name)

  constructor(
    private cacheService: CacheService,
    private ghostModeService: GhostModeService
  ) {}

  /**
   * Example 1: User Joins a Family
   * This invalidates caches that are affected when a new member joins
   */
  async handleUserJoinFamily(userId: string, familyId: string): Promise<void> {
    this.logger.log(`User ${userId} joining family ${familyId}`)

    // Use the event-based invalidation method
    await this.cacheService.invalidateCacheOnUserJoin(userId, familyId)

    // This invalidates:
    // - user:{userId}:families
    // - family:{familyId}:members

    this.logger.log('Cache invalidated for user join')
  }

  /**
   * Example 2: User Leaves a Family
   * This cleans up all caches related to the user's membership
   */
  async handleUserLeaveFamily(userId: string, familyId: string): Promise<void> {
    this.logger.log(`User ${userId} leaving family ${familyId}`)

    // Use the event-based invalidation method
    await this.cacheService.invalidateCacheOnUserLeave(userId, familyId)

    // This invalidates:
    // - user:{userId}:families
    // - family:{familyId}:members
    // - user:{userId}:family:{familyId}:role
    // - user:{userId}:family:{familyId}:last_location
    // - user:{userId}:family:{familyId}:online

    this.logger.log('Cache invalidated for user leave')
  }

  /**
   * Example 3: Update User Role in Family
   * Update the role and refresh the cache
   */
  async handleRoleUpdate(
    userId: string,
    familyId: string,
    newRole: string
  ): Promise<void> {
    this.logger.log(
      `Updating role for user ${userId} in family ${familyId} to ${newRole}`
    )

    // Invalidate before database update
    await this.cacheService.invalidateUserRole(userId, familyId)

    // Perform database update here
    // await this.updateRoleInDatabase(userId, familyId, newRole)

    // Refresh cache with new data
    await this.cacheService.updateUserRoleCache(userId, familyId)

    this.logger.log('Role updated and cache refreshed')
  }

  /**
   * Example 4: Create/Update/Delete Geofence
   * Refresh geofence cache after any change
   */
  async handleGeofenceChange(familyId: string): Promise<void> {
    this.logger.log(`Geofence changed for family ${familyId}`)

    // Update the cache (invalidate + refresh)
    await this.cacheService.updateGeofencesCache(familyId)

    this.logger.log('Geofence cache refreshed')
  }

  /**
   * Example 5: User Enables Global Ghost Mode
   * The ghost mode service automatically updates cache
   */
  async handleEnableGlobalGhostMode(userId: string): Promise<void> {
    this.logger.log(`Enabling global ghost mode for user ${userId}`)

    // This method automatically updates both database and cache
    await this.ghostModeService.setGlobalGhostMode(userId, true)

    // Cache is automatically updated, no manual invalidation needed

    this.logger.log('Global ghost mode enabled and cached')
  }

  /**
   * Example 6: User Enables Family Ghost Mode
   * The ghost mode service automatically updates cache
   */
  async handleEnableFamilyGhostMode(
    userId: string,
    familyId: string
  ): Promise<void> {
    this.logger.log(
      `Enabling family ghost mode for user ${userId} in family ${familyId}`
    )

    // This method automatically updates both database and cache
    await this.ghostModeService.setFamilyGhostMode(userId, familyId, true)

    // Cache is automatically updated, no manual invalidation needed

    this.logger.log('Family ghost mode enabled and cached')
  }

  /**
   * Example 7: Admin Disables Ghost Mode for All Family Members
   * Use bulk invalidation for multiple users
   */
  async handleBulkGhostModeDisable(familyId: string): Promise<void> {
    this.logger.log(
      `Disabling ghost mode for all members in family ${familyId}`
    )

    // Get all family members
    const members = await this.cacheService.getFamilyMembers(familyId)
    const userIds = members.map((m) => m.user_id)

    // Update database for all users
    // await this.bulkDisableGhostModeInDatabase(userIds, familyId)

    // Bulk invalidate cache
    await this.ghostModeService.bulkInvalidateGhostModeCache(userIds, familyId)

    this.logger.log(`Ghost mode disabled for ${userIds.length} members`)
  }

  /**
   * Example 8: Delete Family
   * Clean up all caches before deletion
   */
  async handleDeleteFamily(familyId: string): Promise<void> {
    this.logger.log(`Deleting family ${familyId}`)

    // Get members first (while family still exists)
    const members = await this.cacheService.getFamilyMembers(familyId)

    // Invalidate all family-related cache
    await this.cacheService.invalidateAllFamilyCache(familyId)
    await this.ghostModeService.invalidateFamilyGhostModeCache(familyId)

    // Invalidate user-level caches for all members
    for (const member of members) {
      await this.cacheService.invalidateUserFamilies(member.user_id)
    }

    // Now safe to delete from database
    // await this.deleteFamilyFromDatabase(familyId)

    this.logger.log('Family deleted and all caches invalidated')
  }

  /**
   * Example 9: Delete User Account
   * Clean up all user-related caches
   */
  async handleDeleteUser(userId: string): Promise<void> {
    this.logger.log(`Deleting user ${userId}`)

    // Get user's families first
    const familyIds = await this.cacheService.getUserFamilyIds(userId)

    // Invalidate all user-related cache
    await this.cacheService.invalidateAllUserCache(userId)
    await this.ghostModeService.invalidateUserGhostModeCache(userId)

    // Invalidate family member lists for all families
    for (const familyId of familyIds) {
      await this.cacheService.invalidateFamilyMembers(familyId)
    }

    // Now safe to delete from database
    // await this.deleteUserFromDatabase(userId)

    this.logger.log('User deleted and all caches invalidated')
  }

  /**
   * Example 10: Location Privacy Reset
   * Clear all location data for a family
   */
  async handleLocationPrivacyReset(familyId: string): Promise<void> {
    this.logger.log(`Resetting location privacy for family ${familyId}`)

    // Invalidate all location caches
    await this.cacheService.invalidateAllFamilyLocations(familyId)

    // Clear location history from database
    // await this.clearLocationHistoryFromDatabase(familyId)

    this.logger.log('Location privacy reset completed')
  }

  /**
   * Example 11: System Maintenance - Refresh All Family Data
   * Useful after system updates or cache corruption
   */
  async handleSystemMaintenance(familyId: string): Promise<void> {
    this.logger.log(`Running system maintenance for family ${familyId}`)

    // Update all family-related caches from database
    await this.cacheService.updateAllFamilyCache(familyId)

    // Refresh ghost mode for all members
    const members = await this.cacheService.getFamilyMembers(familyId)
    for (const member of members) {
      await this.ghostModeService.refreshGhostModeCache(
        member.user_id,
        familyId
      )
    }

    this.logger.log('System maintenance completed')
  }

  /**
   * Example 12: Handle Cache Errors Gracefully
   * Always wrap cache operations in try-catch
   */
  async handleCacheOperationWithErrorHandling(
    userId: string,
    familyId: string
  ): Promise<void> {
    try {
      await this.cacheService.invalidateCacheOnUserJoin(userId, familyId)
      this.logger.log('Cache invalidated successfully')
    } catch (error) {
      this.logger.error('Cache invalidation failed:', error)
      // Continue with the operation
      // Cache will eventually expire or be refreshed
      // Database is the source of truth
    }
  }

  /**
   * Example 13: Conditional Cache Invalidation
   * Only invalidate if certain conditions are met
   */
  async handleConditionalInvalidation(
    userId: string,
    familyId: string,
    oldRole: string,
    newRole: string
  ): Promise<void> {
    // Only invalidate if role actually changed
    if (oldRole !== newRole) {
      await this.cacheService.invalidateUserRole(userId, familyId)
      this.logger.log('Role changed, cache invalidated')
    } else {
      this.logger.log('Role unchanged, cache preserved')
    }
  }

  /**
   * Example 14: Batch Location Updates
   * Handle multiple location updates efficiently
   */
  async handleBatchLocationUpdates(
    locations: Array<{ userId: string; familyId: string }>
  ): Promise<void> {
    this.logger.log(`Processing ${locations.length} location updates`)

    // Group by family for efficient invalidation
    const familyGroups = locations.reduce(
      (acc, loc) => {
        if (!acc[loc.familyId]) {
          acc[loc.familyId] = []
        }
        acc[loc.familyId].push(loc.userId)
        return acc
      },
      {} as Record<string, string[]>
    )

    // Invalidate by family
    for (const [familyId, userIds] of Object.entries(familyGroups)) {
      const deletePromises = userIds.map((userId) =>
        this.cacheService.invalidateUserLocation(userId, familyId)
      )
      await Promise.all(deletePromises)
    }

    this.logger.log('Batch location updates processed')
  }

  /**
   * Example 15: Warm Cache on Application Start
   * Pre-populate cache with frequently accessed data
   */
  async warmCacheOnStartup(activeFamilyIds: string[]): Promise<void> {
    this.logger.log(
      `Warming cache for ${activeFamilyIds.length} active families`
    )

    const warmPromises = activeFamilyIds.map(async (familyId) => {
      try {
        // Pre-load family data
        await this.cacheService.updateAllFamilyCache(familyId)

        // Pre-load ghost mode for all members
        const members = await this.cacheService.getFamilyMembers(familyId)
        for (const member of members) {
          await this.ghostModeService.refreshGhostModeCache(
            member.user_id,
            familyId
          )
        }
      } catch (error) {
        this.logger.error(`Failed to warm cache for family ${familyId}:`, error)
        // Continue with other families
      }
    })

    await Promise.all(warmPromises)
    this.logger.log('Cache warming completed')
  }
}
