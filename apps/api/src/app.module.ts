import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
