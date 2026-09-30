import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListProductsQuery, ProductSlugParam } from './catalog.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async getCategories() {
    return this.catalogService.listCategories();
  }

  @Get('products')
  async getProducts(@Query() query: ListProductsQuery) {
    return this.catalogService.listProducts({
      category: query.category,
      page: query.page ? Number(query.page) : 1,
    });
  }

  @Get('products/:slug')
  async getProduct(@Param() param: ProductSlugParam) {
    return this.catalogService.getProductBySlug(param.slug);
  }
}
