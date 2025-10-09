import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, Min, Max, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MqttQoS } from '../interfaces/mqtt.interface';

export class PublishMessageDto {
  @ApiProperty({ description: 'MQTT topic to publish to', example: 'sensors/temperature' })
  @IsString()
  topic: string;

  @ApiProperty({ description: 'Message payload', example: { temperature: 25.5, unit: 'C' } })
  @IsObject()
  payload: any;

  @ApiProperty({ 
    description: 'Quality of Service level',
    enum: [0, 1, 2],
    default: 0
  })
  @IsEnum([0, 1, 2])
  @IsOptional()
  qos?: 0 | 1 | 2;

  @ApiProperty({ description: 'Retain message on broker', default: false })
  @IsBoolean()
  @IsOptional()
  retain?: boolean;
}

export class SubscribeTopicDto {
  @ApiProperty({ description: 'MQTT topic to subscribe to', example: 'sensors/#' })
  @IsString()
  topic: string;

  @ApiProperty({ 
    description: 'Quality of Service level',
    enum: [0, 1, 2],
    default: 0
  })
  @IsEnum([0, 1, 2])
  @IsOptional()
  qos?: 0 | 1 | 2;
}

export class UnsubscribeTopicDto {
  @ApiProperty({ description: 'MQTT topic to unsubscribe from', example: 'sensors/#' })
  @IsString()
  topic: string;
}

export class MqttConnectionDto {
  @ApiProperty({ description: 'MQTT broker host', example: 'broker.hivemq.com' })
  @IsString()
  host: string;

  @ApiProperty({ description: 'MQTT broker port', example: 1883 })
  @IsNumber()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: 'Connection protocol', enum: ['mqtt', 'mqtts', 'ws', 'wss'], default: 'mqtt' })
  @IsEnum(['mqtt', 'mqtts', 'ws', 'wss'])
  @IsOptional()
  protocol?: 'mqtt' | 'mqtts' | 'ws' | 'wss';

  @ApiProperty({ description: 'Username for authentication', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ description: 'Password for authentication', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ description: 'Client ID', required: false })
  @IsString()
  @IsOptional()
  clientId?: string;
}

export class BroadcastMessageDto {
  @ApiProperty({ description: 'Topic pattern to broadcast to', example: 'broadcast/#' })
  @IsString()
  topic: string;

  @ApiProperty({ description: 'Message to broadcast' })
  @IsObject()
  message: any;

  @ApiProperty({ description: 'Include timestamp', default: true })
  @IsBoolean()
  @IsOptional()
  includeTimestamp?: boolean;
}
