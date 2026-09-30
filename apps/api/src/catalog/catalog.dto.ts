import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PAGE_RE = /^([1-9][0-9]{0,2}|1000)$/;

export class ListProductsQuery {
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG_RE)
  category?: string;

  @IsOptional() @IsString() @Matches(PAGE_RE)
  page?: string;
}

export class ProductSlugParam {
  @IsString() @MaxLength(160) @Matches(SLUG_RE)
  slug!: string;
}

export interface CategoryDto {
  name: string;
  slug: string;
}

export interface ProductListItemDto {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  images: string[];
  category: { name: string; slug: string };
}

export interface ProductListResponse {
  items: ProductListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface VariantDto {
  id: string;
  size: string;
  color: string;
  price: number;
  inStock: boolean;
}

export interface ProductDetailDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  images: string[];
  attributes: Record<string, unknown>;
  tags: string[];
  category: { name: string; slug: string };
  variants: VariantDto[];
}
