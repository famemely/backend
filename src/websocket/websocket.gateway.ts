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
    private locationService: LocationService
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
  ) {
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
        client.emit('error', { message: 'Unauthorized family access' })
        return
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

      // Acknowledge
      client.emit('location_ack', {
        success: true,
        timestamp: Date.now()
      })
    } catch (error) {
      this.logger.error('Error handling location update:', error)
      client.emit('error', { message: 'Failed to process location update' })
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
