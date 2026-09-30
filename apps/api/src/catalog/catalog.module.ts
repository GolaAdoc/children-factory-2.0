import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CATALOG_CACHE, NoopCatalogCache } from './catalog-cache';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    { provide: CATALOG_CACHE, useClass: NoopCatalogCache },
    PrismaService,
  ],
})
export class CatalogModule {}
