# Cache Disable Feature

## Overview

The backend now supports disabling Redis caching via an environment variable. This is useful for:

- Debugging cache-related issues
- Testing with always-fresh data from the database
- Development scenarios where cache consistency is problematic

## How to Use

### 1. Set Environment Variable

In your `.env` file:

```bash
# Disable caching (forces all data to come from database)
CACHE_ENABLED=false

# Enable caching (default behavior)
CACHE_ENABLED=true
```

### 2. Restart Backend

After changing the environment variable, restart your backend server:

```bash
cd backend
pnpm run start:dev
```

You should see in the logs:

```
[CacheService] Cache DISABLED
```

Or when enabled:

```
[CacheService] Cache ENABLED
```

## What Gets Disabled

When `CACHE_ENABLED=false`, the following cache operations are skipped:

1. **Family Members Cache**
   - `getFamilyMembers()` - Always queries database
   - No cache writes after database queries

2. **User Families Cache**
   - `getUserFamilyIds()` - Always queries database
   - No cache writes after database queries

3. **Geofences Cache**
   - `getGeofences()` - Always queries database
   - No cache writes after database queries

4. **Location Cache**
   - `getLastLocation()` - Always reads from Redis Streams (not cache)
   - `setLastLocation()` - No cache writes
5. **User Roles Cache**
   - `getUserRole()` - Always queries database
   - No cache writes after database queries

6. **Online Status**
   - `setOnlineStatus()` - No status tracking
   - `getOnlineStatus()` - Always returns false

## Performance Impact

⚠️ **Warning**: Disabling cache will significantly impact performance:

- More database queries per request
- Slower response times for family member lists
- Increased database load
- No benefit from Redis read performance

**Recommendation**: Only disable cache for debugging purposes. Always re-enable for production.

## Implementation Details

The cache disable feature is implemented in `backend/src/cache/cache.service.ts`:

```typescript
constructor(
  private redisService: RedisService,
  private supabaseService: SupabaseService
) {
  this.cacheEnabled = process.env.CACHE_ENABLED !== 'false'
  this.logger.log(`Cache ${this.cacheEnabled ? 'ENABLED' : 'DISABLED'}`)
}
```

All cache read/write operations check `this.cacheEnabled` before executing:

```typescript
if (this.cacheEnabled) {
  const cached = await this.redisService.get<FamilyMember[]>(cacheKey)
  if (cached) {
    return cached
  }
}
```

## Troubleshooting

### Cache still returning stale data

1. Ensure you've set `CACHE_ENABLED=false` in `.env`
2. Restart the backend server completely
3. Check logs for "Cache DISABLED" message
4. Verify no other caching layers (e.g., browser cache, API gateway)

### Backend won't start

1. Ensure `REDIS_URL` is still set in `.env` (even when cache is disabled)
2. Redis connection is still required for streams and pub/sub
3. Check Redis is running: `redis-cli ping`

### Performance is very slow

This is expected when cache is disabled. To improve:

1. Re-enable cache: `CACHE_ENABLED=true`
2. Clear stale cache: `redis-cli FLUSHDB`
3. Restart backend to repopulate cache

## Related Files

- `backend/src/cache/cache.service.ts` - Cache service implementation
- `backend/.env` - Environment configuration
- `backend/.env.example` - Environment template
- `backend/README.md` - Setup documentation
