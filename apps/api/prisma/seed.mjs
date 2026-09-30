import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Seed script cannot be run in production');
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL, // Use runtime app-role URL
});

async function main() {
  console.log('Starting seed...');

  // 1. Upsert Categories
  const catBoys = await prisma.category.upsert({
    where: { slug: 'boys' },
    update: { name: 'Boys' },
    create: { name: 'Boys', slug: 'boys' },
  });
  const catGirls = await prisma.category.upsert({
    where: { slug: 'girls' },
    update: { name: 'Girls' },
    create: { name: 'Girls', slug: 'girls' },
  });
  const catBaby = await prisma.category.upsert({
    where: { slug: 'baby' },
    update: { name: 'Baby' },
    create: { name: 'Baby', slug: 'baby' },
  });
  const catAcc = await prisma.category.upsert({
    where: { slug: 'accessories' },
    update: { name: 'Accessories' },
    create: { name: 'Accessories', slug: 'accessories' },
  });

  const baseDate = new Date('2026-09-30T10:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  
  // 2. Upsert Products
  // first listed is newest -> offset decreases
  const productsData = [
    { name: 'Boys Cotton Tshirt', slug: 'boys-cotton-tshirt', cat: catBoys.id, basePrice: 1200, active: true, images: ["https://example.invalid/img/boys-cotton-tshirt-1.jpg"], desc: "A great t-shirt.", attr: { "fabric": "cotton" }, tags: ["new"] },
    { name: 'Boys Denim Shorts', slug: 'boys-denim-shorts', cat: catBoys.id, basePrice: 1800, active: true, images: [], desc: "Cool denim shorts.", attr: {}, tags: [] },
    { name: 'Boys Zip Hoodie', slug: 'boys-zip-hoodie', cat: catBoys.id, basePrice: 2600, active: true, images: [], desc: "Warm zip hoodie.", attr: {}, tags: [] },
    { name: 'Girls Floral Frock', slug: 'girls-floral-frock', cat: catGirls.id, basePrice: 2500, active: true, images: [], desc: "Beautiful floral frock.", attr: {}, tags: ["new"] },
    { name: 'Girls Cotton Leggings', slug: 'girls-cotton-leggings', cat: catGirls.id, basePrice: 900, active: true, images: [], desc: "Comfortable leggings.", attr: { "fabric": "cotton" }, tags: [] },
    { name: 'Girls Retired Jacket', slug: 'girls-retired-jacket', cat: catGirls.id, basePrice: 3000, active: false, images: [], desc: "Old retired jacket.", attr: {}, tags: [] },
    { name: 'Baby Romper Set', slug: 'baby-romper-set', cat: catBaby.id, basePrice: 1500, active: true, images: [], desc: "Cute romper set.", attr: {}, tags: [] },
    { name: 'Baby Winter Cap', slug: 'baby-winter-cap', cat: catBaby.id, basePrice: 600, active: true, images: [], desc: null, attr: {}, tags: [] }
  ];

  const prodIdMap = new Map();

  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i];
    const createdDate = new Date(baseDate - (i * dayMs)); // first is newest
    
    const upserted = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        categoryId: p.cat,
        name: p.name,
        description: p.desc,
        basePrice: p.basePrice,
        images: p.images,
        attributes: p.attr,
        tags: p.tags,
        isActive: p.active,
        createdAt: createdDate
      },
      create: {
        categoryId: p.cat,
        slug: p.slug,
        name: p.name,
        description: p.desc,
        basePrice: p.basePrice,
        images: p.images,
        attributes: p.attr,
        tags: p.tags,
        isActive: p.active,
        createdAt: createdDate
      }
    });
    prodIdMap.set(p.slug, upserted.id);
  }

  // 3. Upsert Variants
  const variantsData = [
    { pSlug: 'boys-cotton-tshirt', size: '2-3Y', color: 'Blue', sku: 'BCT-23-BLU', override: null, stock: 10, active: true },
    { pSlug: 'boys-cotton-tshirt', size: '4-5Y', color: 'Blue', sku: 'BCT-45-BLU', override: null, stock: 0, active: true },
    { pSlug: 'boys-cotton-tshirt', size: '4-5Y', color: 'Red', sku: 'BCT-45-RED', override: 1000, stock: 5, active: true },
    { pSlug: 'boys-denim-shorts', size: '4-5Y', color: 'Denim', sku: 'BDS-45-DEN', override: null, stock: 7, active: true },
    { pSlug: 'boys-zip-hoodie', size: '6-7Y', color: 'Grey', sku: 'BZH-67-GRY', override: null, stock: 4, active: true },
    { pSlug: 'boys-zip-hoodie', size: '8-9Y', color: 'Grey', sku: 'BZH-89-GRY', override: null, stock: 9, active: false },
    { pSlug: 'girls-floral-frock', size: '2-3Y', color: 'Pink', sku: 'GFF-23-PNK', override: null, stock: 6, active: true },
    { pSlug: 'girls-floral-frock', size: '4-5Y', color: 'Pink', sku: 'GFF-45-PNK', override: null, stock: 3, active: true },
    { pSlug: 'girls-cotton-leggings', size: '4-5Y', color: 'Black', sku: 'GCL-45-BLK', override: null, stock: 12, active: true },
    { pSlug: 'girls-retired-jacket', size: '6-7Y', color: 'Red', sku: 'GRJ-67-RED', override: null, stock: 2, active: true },
    { pSlug: 'baby-romper-set', size: '0-3M', color: 'White', sku: 'BRS-03-WHT', override: null, stock: 8, active: true },
    { pSlug: 'baby-romper-set', size: '3-6M', color: 'White', sku: 'BRS-36-WHT', override: null, stock: 0, active: true },
    { pSlug: 'baby-winter-cap', size: '0-6M', color: 'Cream', sku: 'BWC-06-CRM', override: null, stock: 15, active: true }
  ];

  for (const v of variantsData) {
    const pid = prodIdMap.get(v.pSlug);
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: {
        productId: pid,
        size: v.size,
        color: v.color,
        priceOverride: v.override,
        stockQuantity: v.stock,
        isActive: v.active
      },
      create: {
        productId: pid,
        sku: v.sku,
        size: v.size,
        color: v.color,
        priceOverride: v.override,
        stockQuantity: v.stock,
        isActive: v.active
      }
    });
  }

  const catCount = await prisma.category.count();
  const prodCount = await prisma.product.count();
  const varCount = await prisma.productVariant.count();

  console.log(`Seed complete. Categories: ${catCount}, Products: ${prodCount}, Variants: ${varCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
