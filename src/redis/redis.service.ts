import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger
} from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private redisClient: Redis
  private redisPubClient: Redis
  private redisSubClient: Redis
  private subscribers = new Map<string, Set<(message: any) => void>>()

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.logger.log(`Connecting to Redis at ${redisUrl}`)

    // Main client for general operations
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    })

    // Pub/Sub clients
    this.redisPubClient = new Redis(redisUrl)
    this.redisSubClient = new Redis(redisUrl)

    // Wait for all clients to be ready
    await Promise.all([
      this.redisClient.ping(),
      this.redisPubClient.ping(),
      this.redisSubClient.ping()
    ])

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected')
    })

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis client error:', err)
    })

    this.redisSubClient.on('message', (channel, message) => {
      this.handleMessage(channel, message)
    })

    this.redisSubClient.on('pmessage', (pattern, channel, message) => {
      this.handleMessage(channel, message)
    })

    this.logger.log('Redis service initialized and all clients ready')
  }

  async onModuleDestroy() {
    await this.redisClient.quit()
    await this.redisPubClient.quit()
    await this.redisSubClient.quit()
    this.logger.log('Redis connections closed')
  }

  // ==================== STREAMS ====================

  /**
   * Add entry to Redis Stream
   */
  async addToStream(
    streamKey: string,
    data: Record<string, any>
  ): Promise<string> {
    try {
      const messageId = await this.redisClient.xadd(
        streamKey,
        '*', // Auto-generate ID
        ...this.flattenObject(data)
      )
      if (!messageId) {
        throw new Error('Failed to generate message ID')
      }
      return messageId
    } catch (error) {
      this.logger.error(`Failed to add to stream ${streamKey}:`, error)
      throw error
    }
  }

  /**
   * Read from stream (latest messages)
   */
  async readStream(
    streamKey: string,
    count: number = 100,
    lastId: string = '-'
  ): Promise<any[]> {
    try {
      const results = await this.redisClient.xread(
        'COUNT',
        count,
        'STREAMS',
        streamKey,
        lastId
      )

      if (!results || results.length === 0) {
        return []
      }

      return this.parseStreamResults(results)
    } catch (error) {
      this.logger.error(`Failed to read stream ${streamKey}:`, error)
      throw error
    }
  }

  /**
   * Read from stream with consumer group
   */
  async readStreamGroup(
    streamKey: string,
    groupName: string,
    consumerName: string,
    count: number = 10
  ): Promise<any[]> {
    try {
      // Ensure consumer group exists
      await this.createConsumerGroup(streamKey, groupName).catch(() => {
        // Group already exists, ignore error
      })

      const results = await this.redisClient.xreadgroup(
        'GROUP',
        groupName,
        consumerName,
        'COUNT',
        count,
        'BLOCK',
        1000,
        'STREAMS',
        streamKey,
        '>'
      )

      if (!results || results.length === 0) {
        return []
      }

      return this.parseStreamResults(results)
    } catch (error) {
      this.logger.error(`Failed to read stream group ${streamKey}:`, error)
      throw error
    }
  }

  /**
   * Create consumer group
   */
  async createConsumerGroup(
    streamKey: string,
    groupName: string,
    startId: string = '0'
  ): Promise<void> {
    try {
      await this.redisClient.xgroup(
        'CREATE',
        streamKey,
        groupName,
        startId,
        'MKSTREAM'
      )
      this.logger.log(
        `Consumer group ${groupName} created for stream ${streamKey}`
      )
    } catch (error: any) {
      if (error.message.includes('BUSYGROUP')) {
        // Group already exists
        return
      }
      throw error
    }
  }

  /**
   * Acknowledge message in consumer group
   */
  async ackMessage(
    streamKey: string,
    groupName: string,
    messageId: string
  ): Promise<void> {
    try {
      await this.redisClient.xack(streamKey, groupName, messageId)
    } catch (error) {
      this.logger.error(`Failed to ack message ${messageId}:`, error)
    }
  }

  /**
   * Trim stream to max length
   */
  async trimStream(streamKey: string, maxLen: number = 10000): Promise<void> {
    try {
      await this.redisClient.xtrim(streamKey, 'MAXLEN', '~', maxLen)
    } catch (error) {
      this.logger.error(`Failed to trim stream ${streamKey}:`, error)
    }
  }

  // ==================== PUB/SUB ====================

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<void> {
    try {
      // Wait for redisPubClient to be initialized
      if (!this.redisPubClient) {
        this.logger.warn(`RedisPubClient not initialized yet, waiting...`)
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (this.redisPubClient) break
        }
        if (!this.redisPubClient) {
          throw new Error('RedisPubClient failed to initialize')
        }
      }

      const payload =
        typeof message === 'string' ? message : JSON.stringify(message)
      await this.redisPubClient.publish(channel, payload)
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}:`, error)
      throw error
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    try {
      // Wait for redisSubClient to be initialized
      if (!this.redisSubClient) {
        this.logger.warn(`RedisSubClient not initialized yet, waiting...`)
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (this.redisSubClient) break
        }
        if (!this.redisSubClient) {
          throw new Error('RedisSubClient failed to initialize')
        }
      }

      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set())
        await this.redisSubClient.subscribe(channel)
        this.logger.log(`Subscribed to channel: ${channel}`)
      }

      this.subscribers.get(channel)!.add(callback)
    } catch (error) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, error)
      throw error
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(
    channel: string,
    callback?: (message: any) => void
  ): Promise<void> {
    try {
      if (callback && this.subscribers.has(channel)) {
        this.subscribers.get(channel)!.delete(callback)

        if (this.subscribers.get(channel)!.size === 0) {
          await this.redisSubClient.unsubscribe(channel)
          this.subscribers.delete(channel)
          this.logger.log(`Unsubscribed from channel: ${channel}`)
        }
      } else {
        await this.redisSubClient.unsubscribe(channel)
        this.subscribers.delete(channel)
        this.logger.log(`Unsubscribed from channel: ${channel}`)
      }
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from channel ${channel}:`, error)
    }
  }

  /**
   * Pattern subscribe
   */
  async psubscribe(
    pattern: string,
    callback: (channel: string, message: any) => void
  ): Promise<void> {
    try {
      // Wait for redisSubClient to be initialized
      if (!this.redisSubClient) {
        this.logger.warn(`RedisSubClient not initialized yet, waiting...`)
        // Wait up to 5 seconds for initialization
        for (let i = 0; i < 50; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (this.redisSubClient) break
        }
        if (!this.redisSubClient) {
          throw new Error('RedisSubClient failed to initialize')
        }
      }

      await this.redisSubClient.psubscribe(pattern)
      this.logger.log(`Pattern subscribed: ${pattern}`)

      this.redisSubClient.on('pmessage', (pat, channel, message) => {
        if (pat === pattern) {
          try {
            const parsedMessage = JSON.parse(message)
            callback(channel, parsedMessage)
          } catch {
            callback(channel, message)
          }
        }
      })
    } catch (error) {
      this.logger.error(`Failed to pattern subscribe ${pattern}:`, error)
      throw error
    }
  }

  // ==================== CACHE ====================

  /**
   * Set cache value with expiration
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value)
      await this.redisClient.setex(key, ttlSeconds, payload)
    } catch (error) {
      this.logger.error(`Failed to set cache ${key}:`, error)
      throw error
    }
  }

  /**
   * Get cache value
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key)
      if (!value) return null

      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    } catch (error) {
      this.logger.error(`Failed to get cache ${key}:`, error)
      return null
    }
  }

  /**
   * Delete cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key)
    } catch (error) {
      this.logger.error(`Failed to delete cache ${key}:`, error)
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redisClient.exists(key)
      return result === 1
    } catch (error) {
      this.logger.error(`Failed to check existence of ${key}:`, error)
      return false
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redisClient.expire(key, seconds)
    } catch (error) {
      this.logger.error(`Failed to set expiration on ${key}:`, error)
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.redisClient.incr(key)
    } catch (error) {
      this.logger.error(`Failed to increment ${key}:`, error)
      throw error
    }
  }

  /**
   * Get multiple keys
   */
  async mget(keys: string[]): Promise<any[]> {
    try {
      const values = await this.redisClient.mget(...keys)
      return values.map((v) => {
        if (!v) return null
        try {
          return JSON.parse(v)
        } catch {
          return v
        }
      })
    } catch (error) {
      this.logger.error(`Failed to mget keys:`, error)
      return []
    }
  }

  /**
   * Set multiple keys
   */
  async mset(data: Record<string, any>): Promise<void> {
    try {
      const pairs: string[] = []
      for (const [key, value] of Object.entries(data)) {
        pairs.push(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        )
      }
      await this.redisClient.mset(...pairs)
    } catch (error) {
      this.logger.error(`Failed to mset:`, error)
      throw error
    }
  }

  // ==================== HELPERS ====================

  private handleMessage(channel: string, message: string) {
    const callbacks = this.subscribers.get(channel)
    if (!callbacks) return

    let parsedMessage: any
    try {
      parsedMessage = JSON.parse(message)
    } catch {
      parsedMessage = message
    }

    callbacks.forEach((callback) => {
      try {
        callback(parsedMessage)
      } catch (error) {
        this.logger.error(
          `Error in message callback for channel ${channel}:`,
          error
        )
      }
    })
  }

  private flattenObject(obj: Record<string, any>): string[] {
    const result: string[] = []
    for (const [key, value] of Object.entries(obj)) {
      result.push(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      )
    }
    return result
  }

  private parseStreamResults(results: any[]): any[] {
    const messages: any[] = []

    for (const [streamName, entries] of results) {
      for (const [messageId, fields] of entries) {
        const message: any = { id: messageId, stream: streamName }

        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i]
          const value = fields[i + 1]

          try {
            message[key] = JSON.parse(value)
          } catch {
            message[key] = value
          }
        }

        messages.push(message)
      }
    }

    return messages
  }

  /**
   * Get Redis client for custom operations
   */
  getClient(): Redis {
    return this.redisClient
  }
}
