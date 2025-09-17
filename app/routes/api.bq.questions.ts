import type { LoaderFunctionArgs } from "react-router";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function getBase(): string | null {
  const envAny: any = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {};
  const vite = envAny.VITE_BQ_BACKEND_API_ENDPOINT;
  const srv = (globalThis as any).process?.env?.BQ_BACKEND_URL;
  const base = (vite && String(vite).trim()) || (srv && String(srv).trim()) || '';
  return base || null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method.toUpperCase() !== 'GET') return json({ success: false, error: 'Method not allowed' }, 405);

  const base = getBase();
  if (!base) return json({ success: false, error: 'BQ backend URL not configured' }, 428);

  const root = base.replace(/\/$/, '');
  const candidates = [
    `${root}/questions`,
    `${root}/api/questions`,
    `${root}`,
  ];

  let lastErr: any = null;
  for (const url of candidates) {
    try {
      const resp = await fetch(url, { headers: { 'accept': 'application/json' } });
      if (!resp.ok) { lastErr = new Error(`HTTP ${resp.status}`); continue; }
      const body = await resp.json();
      // Normalize to { success, data }
      const data = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : (Array.isArray(body?.questions) ? body.questions : body));
      return json({ success: true, data }, 200);
    } catch (e: any) {
      lastErr = e;
    }
  }
  return json({ success: false, error: lastErr?.message || 'Upstream error' }, 502);
}
