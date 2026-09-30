const BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

type CatalogResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'unavailable' };

export interface Category {
  name: string;
  slug: string;
}

export interface ProductList {
  items: any[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  images: string[];
  attributes: Record<string, unknown>;
  tags: string[];
  category: Category;
  variants: any[];
}

export async function fetchCategories(): Promise<CatalogResult<Category[]>> {
  try {
    const res = await fetch(`${BASE}/api/categories`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return res.status < 500 ? { ok: false, reason: 'not_found' } : { ok: false, reason: 'unavailable' };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function fetchProducts(category?: string, page: string = '1'): Promise<CatalogResult<ProductList>> {
  try {
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    query.set('page', page);
    
    const res = await fetch(`${BASE}/api/products?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return res.status < 500 ? { ok: false, reason: 'not_found' } : { ok: false, reason: 'unavailable' };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function fetchProductDetail(slug: string): Promise<CatalogResult<ProductDetail>> {
  try {
    const res = await fetch(`${BASE}/api/products/${slug}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return res.status < 500 ? { ok: false, reason: 'not_found' } : { ok: false, reason: 'unavailable' };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
