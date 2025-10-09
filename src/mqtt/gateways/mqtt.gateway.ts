import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { MqttService } from '../services/mqtt.service';
import { PublishMessageDto, SubscribeTopicDto } from '../dto/mqtt.dto';
import { MqttMessage } from '../interfaces/mqtt.interface';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:19006'],
    credentials: true,
  },
  namespace: '/mqtt',
})
export class MqttGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MqttGateway.name);
  private clientSubscriptions: Map<string, Set<string>> = new Map();

  constructor(private mqttService: MqttService) {}

  afterInit(server: Server) {
    this.logger.log('MQTT WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSubscriptions.set(client.id, new Set());
    
    // Send connection status
    client.emit('mqtt:status', this.mqttService.getConnectionStatus());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Cleanup subscriptions
    const topics = this.clientSubscriptions.get(client.id);
    if (topics) {
      topics.forEach(async (topic) => {
        try {
          await this.mqttService.unsubscribe(topic);
        } catch (error) {
          this.logger.error(`Error unsubscribing from ${topic}: ${error.message}`);
        }
      });
      this.clientSubscriptions.delete(client.id);
    }
  }

  @SubscribeMessage('mqtt:publish')
  async handlePublish(
    @MessageBody() data: PublishMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    try {
      await this.mqttService.publish(data);
      return {
        event: 'mqtt:publish:success',
        data: {
          topic: data.topic,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Publish error: ${error.message}`);
      return {
        event: 'mqtt:publish:error',
        data: {
          error: error.message,
        },
      };
    }
  }

  @SubscribeMessage('mqtt:subscribe')
  async handleSubscribe(
    @MessageBody() data: SubscribeTopicDto,
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    try {
      const subscription = await this.mqttService.subscribe(client.id, data);
      
      // Track subscription for this client
      const clientTopics = this.clientSubscriptions.get(client.id) || new Set();
      clientTopics.add(data.topic);
      this.clientSubscriptions.set(client.id, clientTopics);

      // Register message handler to forward messages to WebSocket client
      this.mqttService.registerMessageHandler(data.topic, (message: MqttMessage) => {
        client.emit('mqtt:message', message);
      });

      return {
        event: 'mqtt:subscribe:success',
        data: subscription,
      };
    } catch (error) {
      this.logger.error(`Subscribe error: ${error.message}`);
      return {
        event: 'mqtt:subscribe:error',
        data: {
          error: error.message,
        },
      };
    }
  }

  @SubscribeMessage('mqtt:unsubscribe')
  async handleUnsubscribe(
    @MessageBody() data: { topic: string },
    @ConnectedSocket() client: Socket,
  ): Promise<any> {
    try {
      await this.mqttService.unsubscribe(data.topic);
      
      // Remove from client subscriptions
      const clientTopics = this.clientSubscriptions.get(client.id);
      if (clientTopics) {
        clientTopics.delete(data.topic);
      }

      return {
        event: 'mqtt:unsubscribe:success',
        data: {
          topic: data.topic,
        },
      };
    } catch (error) {
      this.logger.error(`Unsubscribe error: ${error.message}`);
      return {
        event: 'mqtt:unsubscribe:error',
        data: {
          error: error.message,
        },
      };
    }
  }

  @SubscribeMessage('mqtt:status')
  handleGetStatus(@ConnectedSocket() client: Socket): any {
    return {
      event: 'mqtt:status',
      data: this.mqttService.getConnectionStatus(),
    };
  }

  @SubscribeMessage('mqtt:subscriptions')
  handleGetSubscriptions(@ConnectedSocket() client: Socket): any {
    const subscriptions = this.mqttService.getUserSubscriptions(client.id);
    return {
      event: 'mqtt:subscriptions',
      data: subscriptions,
    };
  }

  // Broadcast message to all connected WebSocket clients
  broadcastToClients(event: string, data: any): void {
    this.server.emit(event, data);
  }

  // Send message to specific client
  sendToClient(clientId: string, event: string, data: any): void {
    this.server.to(clientId).emit(event, data);
  }
}
