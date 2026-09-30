import { strict as assert } from 'node:assert';

const API = 'http://127.0.0.1:3001';
const WEB = 'http://127.0.0.1:3000';

const failures = [];
async function check(name, testFn) {
  try {
    await testFn();
  } catch (err) {
    failures.push(`${name} :: ${err.message}`);
  }
}

async function run() {
  console.log('Running verify-catalog.mjs...');
  try {
    // API Checks
    await check('Categories list', async () => {
      const catsRes = await fetch(`${API}/api/categories`);
      assert.equal(catsRes.status, 200);
      const cats = await catsRes.json();
      assert.equal(cats.length, 4, 'Should have exactly 4 categories (seed data only)');
      assert.equal(cats[0].name, 'Accessories', 'Should be sorted by name');
      assert.ok(cats.every(c => !c.id), 'Should not expose category id');
      assert.ok(!catsRes.headers.get('x-powered-by'), 'No x-powered-by on API');
    });

    await check('Products list', async () => {
      const prodsRes = await fetch(`${API}/api/products`);
      assert.equal(prodsRes.status, 200);
      const prods = await prodsRes.json();
      assert.equal(prods.total, 7, 'Should have 7 active products');
      assert.equal(prods.items.length, 7);
      assert.ok(!prods.items.some(p => p.name === 'Girls Retired Jacket'), 'Should exclude inactive product');
      assert.equal(prods.pageSize, 12);
      
      // Check forbidden keys
      const p1 = prods.items[0];
      assert.ok(!('createdAt' in p1), 'Forbidden key createdAt');
      assert.ok(!('isActive' in p1), 'Forbidden key isActive');
    });

    await check('Products filter', async () => {
      const boysRes = await fetch(`${API}/api/products?category=boys`);
      assert.equal(boysRes.status, 200);
      const boysProds = await boysRes.json();
      assert.equal(boysProds.total, 3, 'Boys category should have 3 products');

      const accRes = await fetch(`${API}/api/products?category=accessories`);
      assert.equal(accRes.status, 200);
      const accProds = await accRes.json();
      assert.equal(accProds.total, 0, 'Accessories category should be empty');
    });

    await check('Product detail variants', async () => {
      const detailRes = await fetch(`${API}/api/products/boys-cotton-tshirt`);
      assert.equal(detailRes.status, 200);
      const detail = await detailRes.json();
      assert.equal(detail.variants.length, 3, 'Should have 3 variants (active only)');
      
      const sizes = detail.variants.map(v => v.size);
      assert.ok(sizes.includes('2-3Y') && sizes.includes('4-5Y'));
      
      const v1 = detail.variants.find(v => v.size === '2-3Y');
      assert.equal(v1.price, 1200);
      assert.equal(v1.inStock, true);
      
      const v2 = detail.variants.find(v => v.size === '4-5Y' && v.color === 'Blue');
      assert.equal(v2.price, 1200);
      assert.equal(v2.inStock, false);

      const v3 = detail.variants.find(v => v.size === '4-5Y' && v.color === 'Red');
      assert.equal(v3.price, 1000);
      assert.equal(v3.inStock, true);
    });

    await check('Product inactive exclusions', async () => {
      const zipRes = await fetch(`${API}/api/products/boys-zip-hoodie`);
      assert.equal(zipRes.status, 200);
      const zip = await zipRes.json();
      assert.equal(zip.variants.length, 1, 'Should exclude inactive 8-9Y variant');
    });

    await check('Error cases', async () => {
      const err1 = await fetch(`${API}/api/products/girls-retired-jacket`);
      const err2 = await fetch(`${API}/api/products/non-existent-123`);
      assert.equal(err1.status, 404);
      assert.equal(err2.status, 404);
      assert.equal(await err1.text(), await err2.text(), 'Inactive and nonexistent bodies must be equal');

      const err3 = await fetch(`${API}/api/products/UPPER-CASE`);
      assert.equal(err3.status, 400);

      const err4 = await fetch(`${API}/api/products?pageSize=5`);
      assert.equal(err4.status, 400);

      const postRes = await fetch(`${API}/api/products`, { method: 'POST' });
      assert.equal(postRes.status, 404, 'POST to /api/products returns 404');
    });

    // Web Checks
    await check('Web products list', async () => {
      const webProductsRes = await fetch(`${WEB}/products`);
      assert.equal(webProductsRes.status, 200);
      const webProductsHtml = (await webProductsRes.text()).replace(/<!-- -->/g, '');
      assert.ok(webProductsHtml.includes('Boys Cotton Tshirt'), 'Renders expected name');
      assert.ok(webProductsHtml.includes('Rs 1200'), 'Renders expected price');
      assert.ok(!webProductsHtml.includes('Girls Retired Jacket'), 'Omits inactive product');
      assert.ok(!webProductsHtml.includes('api:3001'), 'No internal API in HTML');
      assert.ok(!webProductsRes.headers.get('x-powered-by'), 'No x-powered-by on web');
    });

    await check('Web product detail', async () => {
      const webDetailRes = await fetch(`${WEB}/products/boys-cotton-tshirt`);
      assert.equal(webDetailRes.status, 200);
      const webDetailHtml = (await webDetailRes.text()).replace(/<!-- -->/g, '');
      assert.ok(webDetailHtml.includes('Boys Cotton Tshirt'), 'Renders name');
      assert.ok(webDetailHtml.includes('1200'), 'Renders price');

      const web404Res = await fetch(`${WEB}/products/non-existent-123`);
      assert.equal(web404Res.status, 404, 'Web passes through 404');
    });
    
    if (failures.length) {
      console.error('verify-catalog: FAIL');
      for (const f of failures) console.error(' - ' + f);
      process.exit(1);
    }
    console.log('verify-catalog: OK');
    process.exit(0);
  } catch (err) {
    console.error('verify-catalog: FATAL ERROR', err);
    process.exit(1);
  }
}

run();
