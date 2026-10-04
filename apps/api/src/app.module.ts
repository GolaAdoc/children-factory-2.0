import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
