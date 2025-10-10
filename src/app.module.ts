import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { SupabaseModule } from './supabase/supabase.module'
import { RedisModule } from './redis/redis.module'
import { CacheModule } from './cache/cache.module'
import { LocationModule } from './location/location.module'
import { WebSocketModule } from './websocket/websocket.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    SupabaseModule,
    RedisModule,
    CacheModule,
    LocationModule,
    WebSocketModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
