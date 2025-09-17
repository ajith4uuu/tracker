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

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method.toUpperCase() !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const base = getBase();
  if (!base) {
    return json({ success: false, error: 'BQ backend URL not configured', data: null }, 200);
  }
  const userId = params.userId as string;

  try {
    const body = await request.text();
    const root = base.replace(/\/$/, '');
    const candidates = [
      `${root}/responses/${encodeURIComponent(userId)}/consent-form`,
      `${root}/survey/responses/${encodeURIComponent(userId)}/consent-form`,
      `${root}/api/responses/${encodeURIComponent(userId)}/consent-form`,
      `${root}/responses/${encodeURIComponent(userId)}/consent_form`,
    ];

    let lastErr: any = null;
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'accept': 'application/json' }, body });
        const text = await resp.text().catch(() => null);
        let data: any = null;
        try { data = JSON.parse(text || 'null'); } catch { data = text; }
        if (!resp.ok) {
          lastErr = { url, status: resp.status, statusText: resp.statusText, body: data };
          continue;
        }
        return json(data ?? { success: true }, 200);
      } catch (e: any) {
        lastErr = { url, message: e?.message || String(e) };
      }
    }

    return json({ success: false, error: 'Upstream fetch failed', detail: lastErr, data: null }, 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Upstream error' }, 200);
  }
};
