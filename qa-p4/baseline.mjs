const urls = [
  'http://127.0.0.1:3001/api/health',
  'http://127.0.0.1:3001/api/categories',
  'http://127.0.0.1:3001/api/products',
  'http://127.0.0.1:3001/api/products/cotton-romper'
];

for (const url of urls) {
  const res = await fetch(url);
  const text = await res.text();
  console.log(`\nGET ${url} - ${res.status}`);
  console.log(text.slice(0, 150));
}
