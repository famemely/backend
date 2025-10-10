import { Module } from '@nestjs/common'
import { LocationController } from './location.controller'
import { LocationService } from './location.service'
import { CacheModule } from '../cache/cache.module'

@Module({
  imports: [CacheModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService]
})
export class LocationModule {}
