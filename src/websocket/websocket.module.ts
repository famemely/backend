import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { WebSocketGatewayService } from './websocket.gateway'
import { CacheModule } from '../cache/cache.module'
import { LocationModule } from '../location/location.module'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' }
      })
    }),
    CacheModule,
    LocationModule
  ],
  providers: [WebSocketGatewayService],
  exports: [WebSocketGatewayService]
})
export class WebSocketModule {}
