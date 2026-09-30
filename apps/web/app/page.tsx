// Rendered per request so the Docker build never needs the API.
export const dynamic = 'force-dynamic';

// Server-side only. API_INTERNAL_URL is not NEXT_PUBLIC_*, so it is never sent to browsers.
async function getApiStatus(): Promise<'ok' | 'unavailable'> {
  const base = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
  try {
    const res = await fetch(`${base}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    return res.ok ? 'ok' : 'unavailable';
  } catch {
    // Never surface upstream details. Degrade the page, do not fail it.
    return 'unavailable';
  }
}

export default async function Home() {
  const api = await getApiStatus();
  return (
    <main>
      <h1>Webstore</h1>
      <p data-api-status={api}>API status: {api}</p>
    </main>
  );
}
