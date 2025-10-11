import { Module } from '@nestjs/common'
import { LocationController } from './location.controller'
import { LocationService } from './location.service'
import { CacheModule } from '../cache/cache.module'
import { GhostModeModule } from '../ghost-mode/ghost-mode.module'

@Module({
  imports: [CacheModule, GhostModeModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService]
})
export class LocationModule {}
