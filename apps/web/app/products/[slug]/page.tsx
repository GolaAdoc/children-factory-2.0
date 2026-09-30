import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProductDetail } from '../../../lib/catalog';

export const revalidate = 60;

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const res = await fetchProductDetail(slug);

  if (res.ok === false) {
    if (res.reason === 'not_found') notFound();
    throw new Error('Catalog temporarily unavailable');
  }

  const p = res.data;

  return (
    <main>
      <h1>{p.name}</h1>
      <p>Rs {p.basePrice}</p>
      {p.description && <p>{p.description}</p>}
      <p>Category: <Link href={`/products?category=${p.category.slug}`}>{p.category.name}</Link></p>
      
      <table>
        <thead>
          <tr>
            <th>Size</th>
            <th>Color</th>
            <th>Price</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {p.variants.map((v: any) => (
            <tr key={v.id}>
              <td>{v.size}</td>
              <td>{v.color}</td>
              <td>Rs {v.price}</td>
              <td>{v.inStock ? 'In stock' : 'Out of stock'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
