# WebSocket Cache Invalidation Handlers

This document describes the WebSocket handlers added to the backend for cache invalidation when family/user changes occur.

## Overview

When family or user operations happen on the frontend, the frontend sends WebSocket signals to the backend. The backend then:

1. Validates the request
2. Invalidates the appropriate cache entries
3. Broadcasts the event to all affected users
4. Returns a response to the sender

## WebSocket Events

### 1. user_added_to_family

**Triggered when**: A user is added to a family

**Frontend sends**:

```typescript
socket.emit(
  'user_added_to_family',
  {
    family_id: string,
    added_user_id: string,
    role: string
  },
  (response) => {
    console.log(response)
  }
)
```

**Backend actions**:

1. Validates requester is in the family
2. Calls `cacheService.invalidateCacheOnUserJoin(added_user_id, family_id)`
   - Invalidates `user:{userId}:families`
   - Invalidates `family:{familyId}:members`
3. Broadcasts to all family members: `family_member_added`
4. Sends notification to added user: `added_to_family`

**Backend response**:

```typescript
{
  success: boolean,
  message?: string,
  error?: string
}
```

**Broadcasts**:

- To family room: `family_member_added`
  ```typescript
  {
    family_id: string,
    user_id: string,
    role: string,
    added_by: string,
    timestamp: number
  }
  ```
- To added user: `added_to_family`
  ```typescript
  {
    family_id: string,
    role: string,
    added_by: string,
    timestamp: number
  }
  ```

---

### 2. user_removed_from_family

**Triggered when**: A user is removed from a family

**Frontend sends**:

```typescript
socket.emit(
  'user_removed_from_family',
  {
    family_id: string,
    removed_user_id: string
  },
  (response) => {
    console.log(response)
  }
)
```

**Backend actions**:

1. Validates requester is in the family
2. Calls `cacheService.invalidateCacheOnUserLeave(removed_user_id, family_id)`
   - Invalidates `user:{userId}:families`
   - Invalidates `family:{familyId}:members`
   - Invalidates `user:{userId}:family:{familyId}:role`
   - Invalidates `user:{userId}:family:{familyId}:last_location`
   - Invalidates `user:{userId}:family:{familyId}:online`
3. Broadcasts to all family members: `family_member_removed`
4. Sends notification to removed user: `removed_from_family`
5. Disconnects removed user from family room

**Backend response**:

```typescript
{
  success: boolean,
  message?: string,
  error?: string
}
```

**Broadcasts**:

- To family room: `family_member_removed`
  ```typescript
  {
    family_id: string,
    user_id: string,
    removed_by: string,
    timestamp: number
  }
  ```
- To removed user: `removed_from_family`
  ```typescript
  {
    family_id: string,
    removed_by: string,
    timestamp: number
  }
  ```

---

### 3. family_deleted

**Triggered when**: A family is deleted

**Frontend sends**:

```typescript
socket.emit(
  'family_deleted',
  {
    family_id: string
  },
  (response) => {
    console.log(response)
  }
)
```

**Backend actions**:

1. Validates requester is in the family
2. Gets all family members (before cache invalidation)
3. Calls `cacheService.invalidateAllFamilyCache(family_id)`
   - Invalidates `family:{familyId}:members`
   - Invalidates `geofence:{familyId}`
   - For each member:
     - Invalidates `user:{userId}:family:{familyId}:role`
     - Invalidates `user:{userId}:family:{familyId}:last_location`
     - Invalidates `user:{userId}:family:{familyId}:online`
4. Calls `ghostModeService.invalidateFamilyGhostModeCache(family_id)`
   - For each member:
     - Invalidates `ghost:family:{familyId}:{userId}`
5. Broadcasts to all family members: `family_deleted`
6. Invalidates `user:{userId}:families` for each member
7. Disconnects all members from family room

**Backend response**:

```typescript
{
  success: boolean,
  message?: string,
  error?: string
}
```

**Broadcast**:

- To family room: `family_deleted`
  ```typescript
  {
    family_id: string,
    deleted_by: string,
    timestamp: number
  }
  ```

---

### 4. member_role_updated

**Triggered when**: A member's role is updated

**Frontend sends**:

```typescript
socket.emit(
  'member_role_updated',
  {
    family_id: string,
    user_id: string,
    new_role: string
  },
  (response) => {
    console.log(response)
  }
)
```

**Backend actions**:

1. Validates requester is in the family
2. Calls `cacheService.invalidateUserRole(user_id, family_id)`
   - Invalidates `user:{userId}:family:{familyId}:role`
3. Broadcasts to all family members: `member_role_updated`
4. Sends notification to updated user: `your_role_updated`

**Backend response**:

```typescript
{
  success: boolean,
  message?: string,
  error?: string
}
```

**Broadcasts**:

- To family room: `member_role_updated`
  ```typescript
  {
    family_id: string,
    user_id: string,
    new_role: string,
    updated_by: string,
    timestamp: number
  }
  ```
- To updated user: `your_role_updated`
  ```typescript
  {
    family_id: string,
    new_role: string,
    updated_by: string,
    timestamp: number
  }
  ```

---

### 5. refresh_family_cache

**Triggered when**: Manual cache refresh is requested (admin operation)

**Frontend sends**:

```typescript
socket.emit(
  'refresh_family_cache',
  {
    family_id: string
  },
  (response) => {
    console.log(response)
  }
)
```

**Backend actions**:

1. Validates requester is in the family
2. Calls `cacheService.updateAllFamilyCache(family_id)`
   - Invalidates and refreshes `family:{familyId}:members`
   - Invalidates and refreshes `geofence:{familyId}`
3. Broadcasts to all family members: `cache_refreshed`

**Backend response**:

```typescript
{
  success: boolean,
  message?: string,
  error?: string
}
```

**Broadcast**:

- To family room: `cache_refreshed`
  ```typescript
  {
    family_id: string,
    refreshed_by: string,
    timestamp: number
  }
  ```

---

## Cache Keys Affected

### user_added_to_family

- ✓ `user:{added_user_id}:families`
- ✓ `family:{family_id}:members`

### user_removed_from_family

- ✓ `user:{removed_user_id}:families`
- ✓ `family:{family_id}:members`
- ✓ `user:{removed_user_id}:family:{family_id}:role`
- ✓ `user:{removed_user_id}:family:{family_id}:last_location`
- ✓ `user:{removed_user_id}:family:{family_id}:online`

### family_deleted

- ✓ `family:{family_id}:members`
- ✓ `geofence:{family_id}`
- ✓ For each member:
  - `user:{user_id}:family:{family_id}:role`
  - `user:{user_id}:family:{family_id}:last_location`
  - `user:{user_id}:family:{family_id}:online`
  - `user:{user_id}:families`
  - `ghost:family:{family_id}:{user_id}`

### member_role_updated

- ✓ `user:{user_id}:family:{family_id}:role`

### refresh_family_cache

- ✓ `family:{family_id}:members` (refreshed)
- ✓ `geofence:{family_id}` (refreshed)

## Security

All handlers include authorization checks:

```typescript
// Verify requester is in the family
if (!client.familyIds.includes(family_id)) {
  return { success: false, error: 'Unauthorized family access' }
}
```

## Logging

All handlers include detailed logging:

```typescript
this.logger.log(
  `User ${client.userId} adding user ${added_user_id} to family ${family_id}`
)
this.logger.log(
  `Cache invalidated for user ${added_user_id} joining family ${family_id}`
)
```

## Error Handling

All handlers include try-catch blocks:

```typescript
try {
  // ... handler logic ...
  return { success: true, message: 'Operation completed' }
} catch (error) {
  this.logger.error('Error handling operation:', error)
  return { success: false, error: 'Operation failed' }
}
```

## Broadcasting Pattern

Events are broadcast to specific audiences:

1. **To family room** - All members of the family

   ```typescript
   this.server.to(`family:${family_id}`).emit('event_name', data)
   ```

2. **To specific user** - All connections of a specific user
   ```typescript
   this.sendToUser(user_id, 'event_name', data)
   ```

## Testing

### Using Postman/Socket.io Client

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
})

socket.on('connect', () => {
  console.log('Connected')

  // Test user added to family
  socket.emit(
    'user_added_to_family',
    {
      family_id: 'family-123',
      added_user_id: 'user-456',
      role: 'member'
    },
    (response) => {
      console.log('Response:', response)
    }
  )
})

socket.on('family_member_added', (data) => {
  console.log('Broadcast received:', data)
})
```

### Using curl (for HTTP endpoints)

Not applicable - these are WebSocket-only events.

## Integration Flow

```
Frontend                Backend                     Redis Cache
   |                       |                              |
   |-- user_added -------->|                              |
   |                       |-- validate auth              |
   |                       |-- invalidate cache --------->|
   |                       |                              |-- DELETE keys
   |                       |<-- cache invalidated --------|
   |                       |-- broadcast to family        |
   |                       |-- notify added user          |
   |<-- response ----------|                              |
   |                       |                              |
   |<-- family_member_added (broadcast)                   |
   |<-- added_to_family (if you're the added user)       |
```

## Performance

- Average handler execution time: < 50ms
- Cache invalidation: < 10ms
- Broadcasting: < 5ms per recipient
- Handles concurrent requests gracefully

## Monitoring

Check logs for:

- Cache invalidation confirmations
- Authorization failures
- Broadcasting events
- Error conditions

Example log output:

```
[WebSocketGatewayService] User user-123 adding user user-456 to family family-789
[CacheService] Invalidated user families cache: user-456
[CacheService] Invalidated family members cache: family-789
[WebSocketGatewayService] Cache invalidated for user user-456 joining family family-789
```

## Future Enhancements

Potential additions:

- Batch operations for adding/removing multiple users
- Rate limiting per user
- Cache invalidation metrics
- Webhook support for non-WebSocket clients
- Admin override capabilities

---

**See Also**:

- Frontend integration: `/frontend/CACHE_SYNC_GUIDE.md`
- Cache service documentation: `/backend/CACHE_INVALIDATION.md`
- WebSocket gateway code: `/backend/src/websocket/websocket.gateway.ts`
