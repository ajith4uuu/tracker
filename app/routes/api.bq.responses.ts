import type { ActionFunctionArgs } from "react-router";

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

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method.toUpperCase() !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const base = getBase();
  if (!base) {
    return json({ success: false, error: 'BQ backend URL not configured', data: null }, 200);
  }

  try {
    const body = await request.text();
    const resp = await fetch(`${base.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body,
    });
    const data = await resp.json();
    return json(data, resp.status);
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Upstream error' }, 502);
  }
};
