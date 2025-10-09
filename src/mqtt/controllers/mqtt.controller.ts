import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MqttService } from '../services/mqtt.service';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';
import { PublishMessageDto, SubscribeTopicDto, BroadcastMessageDto } from '../dto/mqtt.dto';

@ApiTags('MQTT')
@Controller('mqtt')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Get('health')
  @ApiOperation({ summary: 'MQTT service health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'mqtt',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get MQTT connection status' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved' })
  getStatus() {
    return this.mqttService.getConnectionStatus();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get MQTT statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  getStats() {
    return this.mqttService.getStats();
  }

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish message to MQTT topic' })
  @ApiResponse({ status: 200, description: 'Message published successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or MQTT not connected' })
  async publishMessage(@Body() dto: PublishMessageDto) {
    await this.mqttService.publish(dto);
    return {
      success: true,
      topic: dto.topic,
      timestamp: new Date(),
    };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to MQTT topic' })
  @ApiResponse({ status: 201, description: 'Subscribed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or MQTT not connected' })
  async subscribeTopic(@Request() req, @Body() dto: SubscribeTopicDto) {
    const subscription = await this.mqttService.subscribe(req.user.id, dto);
    return {
      success: true,
      subscription,
    };
  }

  @Delete('unsubscribe/:topic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from MQTT topic' })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  async unsubscribeTopic(@Param('topic') topic: string) {
    await this.mqttService.unsubscribe(topic);
    return {
      success: true,
      topic,
      timestamp: new Date(),
    };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  getUserSubscriptions(@Request() req) {
    const subscriptions = this.mqttService.getUserSubscriptions(req.user.id);
    return {
      total: subscriptions.length,
      subscriptions,
    };
  }

  @Get('subscriptions/all')
  @ApiOperation({ summary: 'Get all subscriptions (admin)' })
  @ApiResponse({ status: 200, description: 'All subscriptions retrieved' })
  getAllSubscriptions() {
    const subscriptions = this.mqttService.getAllSubscriptions();
    return {
      total: subscriptions.length,
      subscriptions,
    };
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Broadcast message to topic' })
  @ApiResponse({ status: 200, description: 'Broadcast sent successfully' })
  async broadcastMessage(@Body() dto: BroadcastMessageDto) {
    await this.mqttService.broadcast(dto.topic, dto.message);
    return {
      success: true,
      topic: dto.topic,
      timestamp: new Date(),
    };
  }
}
