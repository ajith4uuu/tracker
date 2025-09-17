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

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (request.method.toUpperCase() !== 'GET') return json({ success: false, error: 'Method not allowed' }, 405);

  const base = getBase();
  if (!base) {
    return json({ success: false, error: 'BQ backend URL not configured', data: null }, 200);
  }
  const userId = params.userId as string;

  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/responses/${encodeURIComponent(userId)}`, { headers: { 'accept': 'application/json' } });
    const data = await resp.json();
    return json(data, resp.status);
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Upstream error' }, 502);
  }
}
