# Redis Cache Invalidation & Update Mechanisms

This document describes the comprehensive cache invalidation and update mechanisms for the Family Location Tracking application.

## Table of Contents

1. [Overview](#overview)
2. [Cache Structure](#cache-structure)
3. [Ghost Mode Cache](#ghost-mode-cache)
4. [Family Cache](#family-cache)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)

## Overview

The application uses Redis for caching to improve performance and reduce database load. Cache invalidation ensures data consistency between the database and cache when changes occur.

### Key Principles

- **Invalidate before update**: Always invalidate cache before updating data
- **Refresh on demand**: Fetch fresh data from database after invalidation
- **Batch operations**: Use bulk invalidation methods for multiple users/families
- **Granular control**: Invalidate specific cache entries or entire contexts

## Cache Structure

### Cache Key Patterns

```
# Ghost Mode
ghost:global:{userId}                          # Global ghost mode state
ghost:family:{familyId}:{userId}               # Family-specific ghost mode state

# Family Data
family:{familyId}:members                      # List of family members
user:{userId}:families                         # User's family IDs

# Geofencing
geofence:{familyId}                            # Family geofences

# User Context
user:{userId}:family:{familyId}:role           # User role in family
user:{userId}:family:{familyId}:last_location  # User's last known location
user:{userId}:family:{familyId}:online         # User's online status

# Location Streams
locations:family:{familyId}                    # Real-time location stream
```

## Ghost Mode Cache

The `GhostModeService` provides comprehensive cache management for ghost mode states.

### Available Methods

#### Individual Invalidation

```typescript
// Clear cache for a specific user/family
await ghostModeService.clearCache(userId, familyId?)

// Invalidate all ghost mode cache for a user
await ghostModeService.invalidateUserGhostModeCache(userId)

// Invalidate ghost mode for all members in a family
await ghostModeService.invalidateFamilyGhostModeCache(familyId)
```

#### Cache Updates

```typescript
// Update cache after database change
await ghostModeService.updateGhostModeCache(userId, familyId, enabled)

// Refresh cache from database
await ghostModeService.refreshGhostModeCache(userId, familyId?)
```

#### Bulk Operations

```typescript
// Invalidate cache for multiple users at once
const userIds = ['user1', 'user2', 'user3']
await ghostModeService.bulkInvalidateGhostModeCache(userIds, familyId?)
```

### Automatic Cache Management

Ghost mode cache is automatically updated when:

- Setting global ghost mode: `setGlobalGhostMode()`
- Setting family ghost mode: `setFamilyGhostMode()`

These methods update both the database AND cache atomically.

## Family Cache

The `CacheService` provides extensive cache management for family-related data.

### Individual Cache Operations

#### Family Members

```typescript
// Invalidate family members cache
await cacheService.invalidateFamilyMembers(familyId)

// Update family members cache (invalidate + refresh)
await cacheService.updateFamilyMembersCache(familyId)
```

#### User Families

```typescript
// Invalidate user's family list
await cacheService.invalidateUserFamilies(userId)

// Update user's family list (invalidate + refresh)
await cacheService.updateUserFamiliesCache(userId)
```

#### Geofences

```typescript
// Invalidate geofences
await cacheService.invalidateGeofences(familyId)

// Update geofences (invalidate + refresh)
await cacheService.updateGeofencesCache(familyId)
```

#### User Roles

```typescript
// Invalidate user role
await cacheService.invalidateUserRole(userId, familyId)

// Update user role (invalidate + refresh)
await cacheService.updateUserRoleCache(userId, familyId)
```

#### Locations

```typescript
// Invalidate specific user location
await cacheService.invalidateUserLocation(userId, familyId)

// Invalidate all family member locations
await cacheService.invalidateAllFamilyLocations(familyId)
```

### Comprehensive Invalidation

#### Full Family Cache

```typescript
// Invalidate ALL cache entries for a family
// Includes: members, geofences, roles, locations, online status
await cacheService.invalidateAllFamilyCache(familyId)

// Update all family cache (invalidate + refresh)
await cacheService.updateAllFamilyCache(familyId)
```

#### Full User Cache

```typescript
// Invalidate ALL cache entries for a user
// Includes: families, roles, locations, online status across all families
await cacheService.invalidateAllUserCache(userId)
```

#### Event-Based Invalidation

```typescript
// When user joins a family
await cacheService.invalidateCacheOnUserJoin(userId, familyId)

// When user leaves a family
await cacheService.invalidateCacheOnUserLeave(userId, familyId)
```

## Usage Examples

### Example 1: User Changes Ghost Mode

```typescript
// User enables global ghost mode
await ghostModeService.setGlobalGhostMode(userId, true)
// ✓ Database updated
// ✓ Cache automatically updated

// Later, if you need to refresh from DB
await ghostModeService.refreshGhostModeCache(userId)
```

### Example 2: Adding a New Family Member

```typescript
// After adding member to database
await cacheService.invalidateCacheOnUserJoin(newUserId, familyId)
// ✓ User's family list invalidated
// ✓ Family members list invalidated
// ✓ Both will be refreshed on next access
```

### Example 3: Removing a Family Member

```typescript
// Before removing member from database
await cacheService.invalidateCacheOnUserLeave(removedUserId, familyId)
// ✓ User's family list invalidated
// ✓ Family members list invalidated
// ✓ User role invalidated
// ✓ Location cache cleared
// ✓ Online status cleared

// Then proceed with database deletion
```

### Example 4: Updating Geofences

```typescript
// After creating/updating/deleting a geofence
await cacheService.updateGeofencesCache(familyId)
// ✓ Old cache invalidated
// ✓ New data fetched and cached
```

### Example 5: Family-Wide Ghost Mode Update

```typescript
// Admin disables ghost mode for all family members
const members = await cacheService.getFamilyMembers(familyId)
const userIds = members.map((m) => m.user_id)

// Bulk invalidate ghost mode cache
await ghostModeService.bulkInvalidateGhostModeCache(userIds, familyId)
// ✓ All members' ghost mode cache invalidated
```

### Example 6: Deleting a Family

```typescript
// Before deleting family
await cacheService.invalidateAllFamilyCache(familyId)
await ghostModeService.invalidateFamilyGhostModeCache(familyId)
// ✓ All family-related cache cleared
// ✓ All ghost mode cache for family cleared

// Get members to invalidate their user-level cache
const members = await cacheService.getFamilyMembers(familyId)
for (const member of members) {
  await cacheService.invalidateUserFamilies(member.user_id)
}

// Then proceed with database deletion
```

### Example 7: User Account Deletion

```typescript
// Before deleting user account
await cacheService.invalidateAllUserCache(userId)
await ghostModeService.invalidateUserGhostModeCache(userId)
// ✓ All user-related cache cleared
// ✓ All ghost mode cache cleared

// Get families to update their member lists
const familyIds = await cacheService.getUserFamilyIds(userId)
for (const familyId of familyIds) {
  await cacheService.invalidateFamilyMembers(familyId)
}

// Then proceed with database deletion
```

## Best Practices

### 1. Invalidate Before Database Changes

```typescript
// ❌ BAD - Cache and DB might be inconsistent
await updateDatabaseRole(userId, familyId, newRole)
await cacheService.invalidateUserRole(userId, familyId)

// ✅ GOOD - Cache cleared before DB update
await cacheService.invalidateUserRole(userId, familyId)
await updateDatabaseRole(userId, familyId, newRole)
```

### 2. Use Event-Based Methods

```typescript
// ❌ BAD - Manual invalidation, might miss something
await cacheService.invalidateUserFamilies(userId)
await cacheService.invalidateFamilyMembers(familyId)

// ✅ GOOD - Use specific event method
await cacheService.invalidateCacheOnUserJoin(userId, familyId)
```

### 3. Use Bulk Operations for Multiple Users

```typescript
// ❌ BAD - Sequential invalidation
for (const userId of userIds) {
  await ghostModeService.clearCache(userId, familyId)
}

// ✅ GOOD - Bulk operation
await ghostModeService.bulkInvalidateGhostModeCache(userIds, familyId)
```

### 4. Use Update Methods When Fresh Data is Needed

```typescript
// ❌ BAD - Invalidate and manually fetch
await cacheService.invalidateFamilyMembers(familyId)
const members = await cacheService.getFamilyMembers(familyId)

// ✅ GOOD - Use update method
await cacheService.updateFamilyMembersCache(familyId)
// Data is now cached and ready
```

### 5. Handle Errors Gracefully

```typescript
try {
  await cacheService.invalidateAllFamilyCache(familyId)
} catch (error) {
  logger.error('Cache invalidation failed:', error)
  // Continue with operation - cache will eventually expire
  // or use fallback to database queries
}
```

### 6. Consider Cache TTL

- Ghost mode cache: 30 days (long-lived, rarely changes)
- Family members: 1 hour (moderate changes)
- Geofences: 1 hour (moderate changes)
- Locations: 5 minutes (frequently updated)
- Online status: 2 minutes (real-time)

### 7. Use Comprehensive Invalidation for Major Changes

```typescript
// When a family is deleted or major restructuring
await cacheService.invalidateAllFamilyCache(familyId)

// When a user account is deleted
await cacheService.invalidateAllUserCache(userId)
```

## Performance Considerations

1. **Batch Operations**: Use bulk methods to reduce Redis round trips
2. **Selective Invalidation**: Only invalidate what's changed, not everything
3. **Update vs Invalidate**: Use `update*Cache()` when fresh data is immediately needed
4. **Async Operations**: Most cache operations are fire-and-forget in background

## Monitoring & Debugging

### Logging

All cache operations are logged with:

- Operation type (invalidate/update)
- Cache keys affected
- Number of entries processed

Example logs:

```
[CacheService] Invalidated family members cache: family-123
[GhostModeService] Updated ghost mode cache for user user-456 in family family-123: true
[CacheService] Invalidating all cache for family: family-789
```

### Common Issues

**Problem**: Cache still shows old data
**Solution**: Ensure invalidation happens before database update

**Problem**: Slow performance with many users
**Solution**: Use bulk operations instead of loops

**Problem**: Cache inconsistency after errors
**Solution**: Implement retry logic or manual cache refresh

## Migration & Maintenance

### Adding New Cache Entries

When adding new cache entries:

1. Add cache key pattern to this documentation
2. Implement invalidation method
3. Add to relevant comprehensive invalidation methods
4. Update TTL appropriately

### Cache Warming

On application start or after major invalidation:

```typescript
// Warm critical caches
for (const familyId of activeFamilyIds) {
  await cacheService.updateAllFamilyCache(familyId)
}
```

---

**Last Updated**: October 11, 2025
**Version**: 1.0.0
