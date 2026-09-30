import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CATALOG_CACHE } from './catalog-cache';
import { RedisCatalogCache } from './redis-catalog-cache';
import { PrismaService } from '../prisma/prisma.service';
import { readEnv } from '../env';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: CATALOG_CACHE,
      useFactory: () => {
        const { REDIS_URL } = readEnv();
        return new RedisCatalogCache(REDIS_URL);
      },
    },
    PrismaService,
  ],
})
export class CatalogModule {}
