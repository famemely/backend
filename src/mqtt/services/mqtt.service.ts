import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { 
  MqttMessage, 
  MqttSubscription, 
  MqttClientConfig, 
  MqttConnectionStatus 
} from '../interfaces/mqtt.interface';
import { PublishMessageDto, SubscribeTopicDto } from '../dto/mqtt.dto';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private subscriptions: Map<string, MqttSubscription> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();
  private connectionStatus: MqttConnectionStatus;

  constructor(private configService: ConfigService) {
    this.connectionStatus = {
      isConnected: false,
      clientId: `famemely_${Date.now()}`,
      reconnectAttempts: 0,
    };
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private getConfig(): MqttClientConfig {
    return {
      host: this.configService.get<string>('MQTT_HOST', 'broker.hivemq.com'),
      port: this.configService.get<number>('MQTT_PORT', 1883),
      protocol: this.configService.get<any>('MQTT_PROTOCOL', 'mqtt'),
      username: this.configService.get<string>('MQTT_USERNAME'),
      password: this.configService.get<string>('MQTT_PASSWORD'),
      clientId: this.connectionStatus.clientId,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };
  }

  async connect(): Promise<void> {
    const config = this.getConfig();
    const url = `${config.protocol}://${config.host}:${config.port}`;

    this.logger.log(`Connecting to MQTT broker at ${url}...`);

    this.client = mqtt.connect(url, {
      clientId: config.clientId,
      clean: config.clean,
      reconnectPeriod: config.reconnectPeriod,
      connectTimeout: config.connectTimeout,
      username: config.username,
      password: config.password,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.log('Successfully connected to MQTT broker');
      this.connectionStatus.isConnected = true;
      this.connectionStatus.connectedAt = new Date();
      this.connectionStatus.reconnectAttempts = 0;
      
      // Re-subscribe to topics after reconnection
      this.resubscribeAll();
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Disconnected from MQTT broker');
      this.connectionStatus.isConnected = false;
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT Error: ${error.message}`, error.stack);
      this.connectionStatus.lastError = error.message;
    });

    this.client.on('reconnect', () => {
      this.connectionStatus.reconnectAttempts++;
      this.logger.log(`Reconnecting to MQTT broker (attempt ${this.connectionStatus.reconnectAttempts})...`);
    });

    this.client.on('message', (topic, payload) => {
      this.handleIncomingMessage(topic, payload);
    });
  }

  private handleIncomingMessage(topic: string, payload: Buffer): void {
    try {
      const message: MqttMessage = {
        topic,
        payload: JSON.parse(payload.toString()),
        qos: 0,
        timestamp: new Date(),
      };

      this.logger.debug(`Received message on topic ${topic}`);

      // Call registered handlers for this topic
      const handlers = this.messageHandlers.get(topic) || [];
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(`Error in message handler: ${error.message}`);
        }
      });

      // Call wildcard handlers
      const wildcardHandlers = this.messageHandlers.get('#') || [];
      wildcardHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(`Error in wildcard handler: ${error.message}`);
        }
      });
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`);
    }
  }

  async publish(dto: PublishMessageDto): Promise<void> {
    if (!this.connectionStatus.isConnected) {
      throw new Error('MQTT client is not connected');
    }

    const payload = JSON.stringify(dto.payload);
    const options: mqtt.IClientPublishOptions = {
      qos: dto.qos || 0,
      retain: dto.retain || false,
    };

    return new Promise((resolve, reject) => {
      this.client.publish(dto.topic, payload, options, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${dto.topic}: ${error.message}`);
          reject(error);
        } else {
          this.logger.log(`Published message to topic: ${dto.topic}`);
          resolve();
        }
      });
    });
  }

  async subscribe(userId: string, dto: SubscribeTopicDto): Promise<MqttSubscription> {
    if (!this.connectionStatus.isConnected) {
      throw new Error('MQTT client is not connected');
    }

    const subscriptionId = `${userId}_${dto.topic}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      this.client.subscribe(dto.topic, { qos: dto.qos || 0 }, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to ${dto.topic}: ${error.message}`);
          reject(error);
        } else {
          const subscription: MqttSubscription = {
            id: subscriptionId,
            topic: dto.topic,
            qos: dto.qos || 0,
            userId,
            createdAt: new Date(),
            isActive: true,
          };

          this.subscriptions.set(subscriptionId, subscription);
          this.logger.log(`User ${userId} subscribed to topic: ${dto.topic}`);
          resolve(subscription);
        }
      });
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.connectionStatus.isConnected) {
      throw new Error('MQTT client is not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to unsubscribe from ${topic}: ${error.message}`);
          reject(error);
        } else {
          // Remove from subscriptions
          for (const [id, sub] of this.subscriptions.entries()) {
            if (sub.topic === topic) {
              this.subscriptions.delete(id);
            }
          }
          this.logger.log(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  registerMessageHandler(topic: string, handler: (message: MqttMessage) => void): void {
    const handlers = this.messageHandlers.get(topic) || [];
    handlers.push(handler);
    this.messageHandlers.set(topic, handlers);
    this.logger.log(`Registered message handler for topic: ${topic}`);
  }

  unregisterMessageHandler(topic: string, handler: Function): void {
    const handlers = this.messageHandlers.get(topic) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.messageHandlers.set(topic, handlers);
    }
  }

  private resubscribeAll(): void {
    this.logger.log('Re-subscribing to all topics...');
    this.subscriptions.forEach((subscription) => {
      this.client.subscribe(subscription.topic, { qos: subscription.qos }, (error) => {
        if (error) {
          this.logger.error(`Failed to re-subscribe to ${subscription.topic}`);
        } else {
          this.logger.log(`Re-subscribed to ${subscription.topic}`);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, {}, () => {
          this.logger.log('Disconnected from MQTT broker');
          this.connectionStatus.isConnected = false;
          resolve();
        });
      });
    }
  }

  getConnectionStatus(): MqttConnectionStatus {
    return { ...this.connectionStatus };
  }

  getUserSubscriptions(userId: string): MqttSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.userId === userId
    );
  }

  getAllSubscriptions(): MqttSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async broadcast(topic: string, message: any): Promise<void> {
    const payload = {
      ...message,
      timestamp: new Date().toISOString(),
      broadcast: true,
    };

    await this.publish({
      topic,
      payload,
      qos: 1,
      retain: false,
    });
  }

  getStats(): any {
    return {
      isConnected: this.connectionStatus.isConnected,
      clientId: this.connectionStatus.clientId,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(s => s.isActive).length,
      reconnectAttempts: this.connectionStatus.reconnectAttempts,
      connectedAt: this.connectionStatus.connectedAt,
      lastError: this.connectionStatus.lastError,
    };
  }
}
