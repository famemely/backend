import { Module } from '@nestjs/common';
import { MqttService } from './services/mqtt.service';
import { MqttController } from './controllers/mqtt.controller';
import { MqttGateway } from './gateways/mqtt.gateway';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [MqttController],
  providers: [MqttService, MqttGateway],
  exports: [MqttService, MqttGateway],
})
export class MqttModule {}
