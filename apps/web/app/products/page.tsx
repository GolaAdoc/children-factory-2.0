import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchCategories, fetchProducts } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const { category, page } = await searchParams;
  
  const [catsRes, prodsRes] = await Promise.all([
    fetchCategories(),
    fetchProducts(category, page ?? '1')
  ]);

  if (prodsRes.ok === false) {
    if (prodsRes.reason === 'not_found') notFound();
    return <main><p>Catalog temporarily unavailable</p></main>;
  }

  const { data: prods } = prodsRes;

  return (
    <main>
      <h1>Products</h1>
      {catsRes.ok && (
        <nav>
          <ul>
            <li><Link href="/products">All</Link></li>
            {catsRes.data.map(c => (
              <li key={c.slug}><Link href={`/products?category=${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </nav>
      )}

      {prods.items.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ul>
          {prods.items.map(p => (
            <li key={p.id}>
              <div style={{ width: '100px', height: '100px', backgroundColor: '#eee' }} />
              <h2><Link href={`/products/${p.slug}`}>{p.name}</Link></h2>
              <p>Rs {p.basePrice}</p>
            </li>
          ))}
        </ul>
      )}

      <div>
        {prods.page > 1 && (
          <Link href={`/products?${category ? `category=${category}&` : ''}page=${prods.page - 1}`}>Prev</Link>
        )}
        {prods.page * prods.pageSize < prods.total && (
          <Link href={`/products?${category ? `category=${category}&` : ''}page=${prods.page + 1}`}>Next</Link>
        )}
      </div>
    </main>
  );
}
