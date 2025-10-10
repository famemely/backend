import { Module } from '@nestjs/common'
import { CacheService } from './cache.service'
import { RedisModule } from '../redis/redis.module'
import { SupabaseModule } from '../supabase/supabase.module'

@Module({
  imports: [RedisModule, SupabaseModule],
  providers: [CacheService],
  exports: [CacheService]
})
export class CacheModule {}
