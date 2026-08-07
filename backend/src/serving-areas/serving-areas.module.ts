import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServingArea } from './serving-area.entity';
import { ServingAreasController } from './serving-areas.controller';
import { ServingAreasService } from './serving-areas.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServingArea])],
  controllers: [ServingAreasController],
  providers: [ServingAreasService],
  exports: [ServingAreasService],
})
export class ServingAreasModule {}
