import { Module } from '@nestjs/common'
import { GhostModeService } from './ghost-mode.service'
import { RedisModule } from '../redis/redis.module'

@Module({
  imports: [RedisModule],
  providers: [GhostModeService],
  exports: [GhostModeService]
})
export class GhostModeModule {}
