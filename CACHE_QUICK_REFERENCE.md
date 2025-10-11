# Cache Invalidation Quick Reference

Quick reference for cache invalidation operations in the Family Location Tracking app.

## Ghost Mode Cache Operations

### GhostModeService Methods

| Method                             | Use Case                                  | Parameters                  |
| ---------------------------------- | ----------------------------------------- | --------------------------- |
| `clearCache()`                     | Clear ghost mode for specific user/family | `userId, familyId?`         |
| `invalidateUserGhostModeCache()`   | Clear all ghost modes for user            | `userId`                    |
| `invalidateFamilyGhostModeCache()` | Clear ghost modes for all family members  | `familyId`                  |
| `updateGhostModeCache()`           | Update cache after DB change              | `userId, familyId, enabled` |
| `refreshGhostModeCache()`          | Refresh from database                     | `userId, familyId?`         |
| `bulkInvalidateGhostModeCache()`   | Clear for multiple users                  | `userIds[], familyId?`      |

## Family Cache Operations

### CacheService Methods

#### Individual Invalidation

| Method                           | Cache Cleared        | Parameters         |
| -------------------------------- | -------------------- | ------------------ |
| `invalidateFamilyMembers()`      | Family members list  | `familyId`         |
| `invalidateUserFamilies()`       | User's family IDs    | `userId`           |
| `invalidateGeofences()`          | Family geofences     | `familyId`         |
| `invalidateUserRole()`           | User role in family  | `userId, familyId` |
| `invalidateUserLocation()`       | User's last location | `userId, familyId` |
| `invalidateAllFamilyLocations()` | All member locations | `familyId`         |

#### Update Methods (Invalidate + Refresh)

| Method                       | Operation              | Parameters         |
| ---------------------------- | ---------------------- | ------------------ |
| `updateFamilyMembersCache()` | Refresh family members | `familyId`         |
| `updateUserFamiliesCache()`  | Refresh user families  | `userId`           |
| `updateGeofencesCache()`     | Refresh geofences      | `familyId`         |
| `updateUserRoleCache()`      | Refresh user role      | `userId, familyId` |

#### Comprehensive Invalidation

| Method                       | Scope                   | Parameters |
| ---------------------------- | ----------------------- | ---------- |
| `invalidateAllFamilyCache()` | Everything for a family | `familyId` |
| `invalidateAllUserCache()`   | Everything for a user   | `userId`   |
| `updateAllFamilyCache()`     | Refresh all family data | `familyId` |

#### Event-Based Invalidation

| Method                         | Trigger            | Parameters         |
| ------------------------------ | ------------------ | ------------------ |
| `invalidateCacheOnUserJoin()`  | User joins family  | `userId, familyId` |
| `invalidateCacheOnUserLeave()` | User leaves family | `userId, familyId` |

## Common Scenarios

### User Operations

```typescript
// User joins family
await cacheService.invalidateCacheOnUserJoin(userId, familyId)

// User leaves family
await cacheService.invalidateCacheOnUserLeave(userId, familyId)

// User role changed
await cacheService.updateUserRoleCache(userId, familyId)

// User enables ghost mode
await ghostModeService.setGlobalGhostMode(userId, true) // Auto-updates cache

// User deleted
await cacheService.invalidateAllUserCache(userId)
await ghostModeService.invalidateUserGhostModeCache(userId)
```

### Family Operations

```typescript
// Family created - no cache to invalidate

// Family deleted
await cacheService.invalidateAllFamilyCache(familyId)
await ghostModeService.invalidateFamilyGhostModeCache(familyId)

// Family members changed
await cacheService.updateFamilyMembersCache(familyId)

// Geofence added/updated/deleted
await cacheService.updateGeofencesCache(familyId)
```

### Ghost Mode Operations

```typescript
// Set global ghost mode
await ghostModeService.setGlobalGhostMode(userId, enabled) // Auto-updates cache

// Set family ghost mode
await ghostModeService.setFamilyGhostMode(userId, familyId, enabled) // Auto-updates cache

// Family-wide ghost mode change
const members = await cacheService.getFamilyMembers(familyId)
await ghostModeService.bulkInvalidateGhostModeCache(
  members.map((m) => m.user_id),
  familyId
)

// Refresh ghost mode from DB
await ghostModeService.refreshGhostModeCache(userId, familyId)
```

### Location Operations

```typescript
// User location updated - handled automatically by location service

// Clear specific user location
await cacheService.invalidateUserLocation(userId, familyId)

// Clear all family locations (e.g., privacy reset)
await cacheService.invalidateAllFamilyLocations(familyId)
```

## Cache Keys Reference

```
ghost:global:{userId}
ghost:family:{familyId}:{userId}
family:{familyId}:members
user:{userId}:families
geofence:{familyId}
user:{userId}:family:{familyId}:role
user:{userId}:family:{familyId}:last_location
user:{userId}:family:{familyId}:online
locations:family:{familyId}
```

## TTL Values

| Cache Type     | TTL       | Notes                      |
| -------------- | --------- | -------------------------- |
| Ghost Mode     | 30 days   | Long-lived, rarely changes |
| Family Members | 1 hour    | Moderate update frequency  |
| User Families  | 1 hour    | Moderate update frequency  |
| Geofences      | 1 hour    | Moderate update frequency  |
| User Roles     | 1 hour    | Moderate update frequency  |
| Locations      | 5 minutes | Frequently updated         |
| Online Status  | 2 minutes | Real-time data             |

## Best Practices

✅ **DO**

- Invalidate before database updates
- Use event-based methods for common operations
- Use bulk operations for multiple users
- Use update methods when fresh data is needed immediately

❌ **DON'T**

- Update database before invalidating cache
- Invalidate cache in loops (use bulk methods)
- Forget to invalidate related caches
- Ignore errors (log and continue)

## Error Handling

```typescript
try {
  await cacheService.invalidateAllFamilyCache(familyId)
} catch (error) {
  logger.error('Cache invalidation failed:', error)
  // Continue - cache will expire naturally
}
```

---

**See Also**: [CACHE_INVALIDATION.md](./CACHE_INVALIDATION.md) for detailed documentation
