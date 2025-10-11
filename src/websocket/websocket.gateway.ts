import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger, UseGuards } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { RedisService } from '../redis/redis.service'
import { CacheService } from '../cache/cache.service'
import { LocationService } from '../location/location.service'
import { GhostModeService } from '../ghost-mode/ghost-mode.service'

interface AuthenticatedSocket extends Socket {
  userId: string
  familyIds: string[]
  roles: Record<string, string>
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  transports: ['websocket', 'polling']
})
export class WebSocketGatewayService
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(WebSocketGatewayService.name)
  private readonly connectedUsers = new Map<string, Set<string>>() // userId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
    private cacheService: CacheService,
    private locationService: LocationService,
    private ghostModeService: GhostModeService
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized')
    this.setupRedisSubscriptions()
  }

  async handleConnection(client: Socket) {
    try {
      // Extract and verify JWT token
      const token = this.extractToken(client)
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`)
        client.disconnect()
        return
      }

      const payload = await this.verifyToken(token)
      if (!payload) {
        this.logger.warn(`Connection rejected: Invalid token`)
        client.disconnect()
        return
      }

      // Attach user info to socket
      const authSocket = client as AuthenticatedSocket
      authSocket.userId = payload.sub || payload.userId

      // Fetch user's family IDs from database (with caching)
      const familyIds = await this.cacheService.getUserFamilyIds(
        authSocket.userId
      )
      authSocket.familyIds = familyIds
      authSocket.roles = {} // Empty for now, can be populated later if needed

      this.logger.log(
        `User ${authSocket.userId} belongs to ${familyIds.length} families: ${familyIds.join(', ')}`
      )

      // Track connection
      if (!this.connectedUsers.has(authSocket.userId)) {
        this.connectedUsers.set(authSocket.userId, new Set())
      }
      this.connectedUsers.get(authSocket.userId)!.add(client.id)

      // Join family rooms
      for (const familyId of authSocket.familyIds) {
        await client.join(`family:${familyId}`)
        await this.cacheService.setOnlineStatus(
          authSocket.userId,
          familyId,
          true
        )

        // Broadcast user online status
        this.server.to(`family:${familyId}`).emit('presence_update', {
          user_id: authSocket.userId,
          family_id: familyId,
          status: 'online',
          timestamp: Date.now()
        })
      }

      this.logger.log(
        `Client connected: ${client.id} (User: ${authSocket.userId}, Families: ${authSocket.familyIds.join(', ')})`
      )

      // Send connection acknowledgment
      client.emit('connected', {
        message: 'Connected successfully',
        userId: authSocket.userId,
        familyIds: authSocket.familyIds
      })
    } catch (error) {
      this.logger.error('Error handling connection:', error)
      client.disconnect()
    }
  }

  async handleDisconnect(client: Socket) {
    const authSocket = client as AuthenticatedSocket

    if (authSocket.userId) {
      // Remove from tracking
      const userSockets = this.connectedUsers.get(authSocket.userId)
      if (userSockets) {
        userSockets.delete(client.id)

        // If no more connections, mark as offline
        if (userSockets.size === 0) {
          this.connectedUsers.delete(authSocket.userId)

          for (const familyId of authSocket.familyIds || []) {
            await this.cacheService.setOnlineStatus(
              authSocket.userId,
              familyId,
              false
            )

            // Broadcast user offline status
            this.server.to(`family:${familyId}`).emit('presence_update', {
              user_id: authSocket.userId,
              family_id: familyId,
              status: 'offline',
              timestamp: Date.now(),
              last_seen: Date.now()
            })
          }
        }
      }

      this.logger.log(
        `Client disconnected: ${client.id} (User: ${authSocket.userId})`
      )
    }
  }

  @SubscribeMessage('location_update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any
  ): Promise<{ success: boolean; timestamp: number }> {
    try {
      const {
        family_id,
        latitude,
        longitude,
        accuracy,
        timestamp,
        batteryLevel,
        batteryState
      } = data

      if (!family_id || !client.familyIds.includes(family_id)) {
        this.logger.warn(
          `Unauthorized family access attempt by ${client.userId}`
        )
        return { success: false, timestamp: Date.now() }
      }

      // Process location update
      await this.locationService.processLocationUpdate(client.userId, {
        family_id,
        latitude,
        longitude,
        accuracy,
        timestamp,
        batteryLevel,
        batteryState
      })

      // Return acknowledgment (this will be sent as callback response)
      return {
        success: true,
        timestamp: Date.now()
      }
    } catch (error) {
      this.logger.error('Error handling location update:', error)
      return {
        success: false,
        timestamp: Date.now()
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() })
  }

  @SubscribeMessage('join_family')
  async handleJoinFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { family_id: string }
  ) {
    try {
      const { family_id } = data
      this.logger.log(
        `User ${client.userId} attempting to join family: ${family_id}`
      )

      if (!client.familyIds.includes(family_id)) {
        this.logger.warn(
          `User ${client.userId} unauthorized to join family ${family_id}`
        )
        return { success: false, error: 'Unauthorized family access' }
      }

      this.logger.log(
        `User ${client.userId} authorized to join family: ${family_id}`
      )
      await client.join(`family:${family_id}`)

      this.logger.log(`User ${client.userId} joined family room: ${family_id}`)
      await this.cacheService.setOnlineStatus(client.userId, family_id, true)

      this.logger.log(
        `User ${client.userId} online status set for family: ${family_id}`
      )

      // Broadcast to other family members
      this.server.to(`family:${family_id}`).emit('presence_update', {
        user_id: client.userId,
        family_id,
        status: 'online',
        timestamp: Date.now()
      })

      // Return success to the client (this is the callback acknowledgment)
      return { success: true, family_id }
    } catch (error) {
      this.logger.error(`Error joining family: ${error}`)
      return { success: false, error: 'Failed to join family' }
    }
  }

  @SubscribeMessage('leave_family')
  async handleLeaveFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { family_id: string }
  ) {
    try {
      const { family_id } = data

      await client.leave(`family:${family_id}`)
      await this.cacheService.setOnlineStatus(client.userId, family_id, false)

      // Broadcast to other family members
      this.server.to(`family:${family_id}`).emit('presence_update', {
        user_id: client.userId,
        family_id,
        status: 'offline',
        timestamp: Date.now()
      })

      // Return success to the client
      return { success: true, family_id }
    } catch (error) {
      this.logger.error(`Error leaving family: ${error}`)
      return { success: false, error: 'Failed to leave family' }
    }
  }

  @SubscribeMessage('ghost_mode')
  async handleGhostMode(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      enabled: boolean
      scope: 'global' | 'family'
      family_id?: string
    }
  ) {
    try {
      const { enabled, scope, family_id } = data

      this.logger.log(
        `Ghost mode change: User ${client.userId}, scope: ${scope}, enabled: ${enabled}, family: ${family_id || 'N/A'}`
      )

      // Update ghost mode state
      if (scope === 'global') {
        await this.ghostModeService.setGlobalGhostMode(client.userId, enabled)

        // Broadcast to all families the user belongs to
        for (const familyId of client.familyIds) {
          this.server.to(`family:${familyId}`).emit('ghost_mode', {
            user_id: client.userId,
            family_id: familyId,
            enabled,
            scope: 'global',
            timestamp: Date.now()
          })
        }
      } else if (scope === 'family' && family_id) {
        // Verify user is in this family
        if (!client.familyIds.includes(family_id)) {
          return { success: false, error: 'Unauthorized family access' }
        }

        await this.ghostModeService.setFamilyGhostMode(
          client.userId,
          family_id,
          enabled
        )

        // Broadcast to specific family
        this.server.to(`family:${family_id}`).emit('ghost_mode', {
          user_id: client.userId,
          family_id,
          enabled,
          scope: 'family',
          timestamp: Date.now()
        })
      } else {
        return { success: false, error: 'Invalid ghost mode request' }
      }

      return { success: true }
    } catch (error) {
      this.logger.error('Error handling ghost mode:', error)
      return { success: false, error: 'Failed to update ghost mode' }
    }
  }

  /**
   * Handle user added to family
   * Invalidates cache and broadcasts to all family members
   */
  @SubscribeMessage('user_added_to_family')
  async handleUserAddedToFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      family_id: string
      added_user_id: string
      role: string
    }
  ) {
    try {
      const { family_id, added_user_id, role } = data

      this.logger.log(
        `User ${client.userId} adding user ${added_user_id} to family ${family_id}`
      )

      // Verify requester is in this family and has permission
      if (!client.familyIds.includes(family_id)) {
        return { success: false, error: 'Unauthorized family access' }
      }

      // Invalidate cache for the event
      await this.cacheService.invalidateCacheOnUserJoin(
        added_user_id,
        family_id
      )

      this.logger.log(
        `Cache invalidated for user ${added_user_id} joining family ${family_id}`
      )

      // Broadcast to all family members
      this.server.to(`family:${family_id}`).emit('family_member_added', {
        family_id,
        user_id: added_user_id,
        role,
        added_by: client.userId,
        timestamp: Date.now()
      })

      // Notify the added user if they're connected
      this.sendToUser(added_user_id, 'added_to_family', {
        family_id,
        role,
        added_by: client.userId,
        timestamp: Date.now()
      })

      return { success: true, message: 'User added and cache invalidated' }
    } catch (error) {
      this.logger.error('Error handling user added to family:', error)
      return { success: false, error: 'Failed to add user to family' }
    }
  }

  /**
   * Handle user removed from family
   * Invalidates cache and broadcasts to all family members
   */
  @SubscribeMessage('user_removed_from_family')
  async handleUserRemovedFromFamily(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      family_id: string
      removed_user_id: string
    }
  ) {
    try {
      const { family_id, removed_user_id } = data

      this.logger.log(
        `User ${client.userId} removing user ${removed_user_id} from family ${family_id}`
      )

      // Verify requester is in this family and has permission
      if (!client.familyIds.includes(family_id)) {
        return { success: false, error: 'Unauthorized family access' }
      }

      // Invalidate cache for the event
      await this.cacheService.invalidateCacheOnUserLeave(
        removed_user_id,
        family_id
      )

      this.logger.log(
        `Cache invalidated for user ${removed_user_id} leaving family ${family_id}`
      )

      // Broadcast to all family members,
      this.server.to(`family:${family_id}`).emit('family_member_removed', {
        family_id,
        user_id: removed_user_id,
        removed_by: client.userId,
        timestamp: Date.now()
      })

      // Notify the removed user if they're connected
      this.sendToUser(removed_user_id, 'removed_from_family', {
        family_id,
        removed_by: client.userId,
        timestamp: Date.now()
      })

      // Disconnect the removed user from this family room
      const userSockets = this.connectedUsers.get(removed_user_id)
      if (userSockets) {
        userSockets.forEach((socketId) => {
          const socket = this.server.sockets.sockets.get(socketId)
          if (socket) {
            socket.leave(`family:${family_id}`)
          }
        })
      }

      return { success: true, message: 'User removed and cache invalidated' }
    } catch (error) {
      this.logger.error('Error handling user removed from family:', error)
      return { success: false, error: 'Failed to remove user from family' }
    }
  }

  /**
   * Handle family deletion
   * Invalidates all family-related cache and disconnects all members
   */
  @SubscribeMessage('family_deleted')
  async handleFamilyDeleted(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      family_id: string
    }
  ) {
    try {
      const { family_id } = data

      this.logger.log(`User ${client.userId} deleting family ${family_id}`)

      // Verify requester is in this family and has permission (should be admin/owner)
      if (!client.familyIds.includes(family_id)) {
        return { success: false, error: 'Unauthorized family access' }
      }

      // Get all family members before cache invalidation
      const members = await this.cacheService.getFamilyMembers(family_id)

      // Invalidate all family cache
      await this.cacheService.invalidateAllFamilyCache(family_id)
      await this.ghostModeService.invalidateFamilyGhostModeCache(family_id)

      this.logger.log(`All cache invalidated for deleted family ${family_id}`)

      // Broadcast to all family members before disconnecting
      this.server.to(`family:${family_id}`).emit('family_deleted', {
        family_id,
        deleted_by: client.userId,
        timestamp: Date.now()
      })

      // Invalidate user family lists for all members
      for (const member of members) {
        await this.cacheService.invalidateUserFamilies(member.user_id)

        // Disconnect member from family room
        const userSockets = this.connectedUsers.get(member.user_id)
        if (userSockets) {
          userSockets.forEach((socketId) => {
            const socket = this.server.sockets.sockets.get(socketId)
            if (socket) {
              socket.leave(`family:${family_id}`)
            }
          })
        }
      }

      this.logger.log(
        `Family ${family_id} deleted: ${members.length} members disconnected and cache invalidated`
      )

      return {
        success: true,
        message: 'Family deleted and all cache invalidated'
      }
    } catch (error) {
      this.logger.error('Error handling family deletion:', error)
      return { success: false, error: 'Failed to delete family' }
    }
  }

  /**
   * Handle member role update
   * Invalidates role cache and broadcasts to family
   */
  @SubscribeMessage('member_role_updated')
  async handleMemberRoleUpdated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      family_id: string
      user_id: string
      new_role: string
    }
  ) {
    try {
      const { family_id, user_id, new_role } = data

      this.logger.log(
        `User ${client.userId} updating role for ${user_id} in family ${family_id} to ${new_role}`
      )

      // Verify requester is in this family
      if (!client.familyIds.includes(family_id)) {
        return { success: false, error: 'Unauthorized family access' }
      }

      // Invalidate role cache
      await this.cacheService.invalidateUserRole(user_id, family_id)

      this.logger.log(
        `Role cache invalidated for user ${user_id} in family ${family_id}`
      )

      // Broadcast to family members
      this.server.to(`family:${family_id}`).emit('member_role_updated', {
        family_id,
        user_id,
        new_role,
        updated_by: client.userId,
        timestamp: Date.now()
      })

      // Notify the user whose role was updated
      this.sendToUser(user_id, 'your_role_updated', {
        family_id,
        new_role,
        updated_by: client.userId,
        timestamp: Date.now()
      })

      return { success: true, message: 'Role updated and cache invalidated' }
    } catch (error) {
      this.logger.error('Error handling role update:', error)
      return { success: false, error: 'Failed to update role' }
    }
  }

  /**
   * Handle cache refresh request
   * Manually refresh cache for a family (admin operation)
   */
  @SubscribeMessage('refresh_family_cache')
  async handleRefreshFamilyCache(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      family_id: string
    }
  ) {
    try {
      const { family_id } = data

      this.logger.log(
        `User ${client.userId} requesting cache refresh for family ${family_id}`
      )

      // Verify requester is in this family
      if (!client.familyIds.includes(family_id)) {
        return { success: false, error: 'Unauthorized family access' }
      }

      // Refresh all family cache
      await this.cacheService.updateAllFamilyCache(family_id)

      this.logger.log(`Cache refreshed for family ${family_id}`)

      // Broadcast cache refresh event
      this.server.to(`family:${family_id}`).emit('cache_refreshed', {
        family_id,
        refreshed_by: client.userId,
        timestamp: Date.now()
      })

      return { success: true, message: 'Family cache refreshed' }
    } catch (error) {
      this.logger.error('Error refreshing family cache:', error)
      return { success: false, error: 'Failed to refresh cache' }
    }
  }

  /**
   * Setup Redis Pub/Sub subscriptions for broadcasts
   */
  private setupRedisSubscriptions() {
    // Subscribe to location updates pattern
    this.redisService.psubscribe('family:*:location', (channel, message) => {
      const familyId = channel.split(':')[1]
      this.server.to(`family:${familyId}`).emit('location_update', message)
    })

    // Subscribe to alerts pattern
    this.redisService.psubscribe('family:*:alerts', (channel, message) => {
      const familyId = channel.split(':')[1]
      this.server.to(`family:${familyId}`).emit('geofence_alert', message)
    })

    // Subscribe to notifications pattern
    this.redisService.psubscribe('user:*:notifications', (channel, message) => {
      const userId = channel.split(':')[1]

      // Send to all sockets of this user
      const userSockets = this.connectedUsers.get(userId)
      if (userSockets) {
        userSockets.forEach((socketId) => {
          this.server.to(socketId).emit('notification', message)
        })
      }
    })

    this.logger.log('Redis Pub/Sub subscriptions established')
  }

  /**
   * Extract JWT token from socket handshake
   */
  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }

    // Try query parameter
    const token = client.handshake.query.token
    if (token && typeof token === 'string') {
      return token
    }

    // Try auth object
    const authToken = client.handshake.auth?.token
    if (authToken && typeof authToken === 'string') {
      return authToken
    }

    return null
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      return await this.jwtService.verifyAsync(token)
    } catch (error) {
      this.logger.error('Token verification failed:', error)
      return null
    }
  }

  /**
   * Broadcast to family room
   */
  broadcastToFamily(familyId: string, event: string, data: any) {
    this.server.to(`family:${familyId}`).emit(event, data)
  }

  /**
   * Send to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    const userSockets = this.connectedUsers.get(userId)
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data)
      })
    }
  }
}
