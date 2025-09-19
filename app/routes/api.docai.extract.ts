import { Storage } from "@google-cloud/storage";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import type { ActionFunctionArgs } from "react-router";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method.toUpperCase() !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  try {
    let form;
    try {
      // Prefer reading from a clone first (some runtimes allow clone even if original not readable)
      try {
        const cloned = request.clone();
        form = await cloned.formData();
      } catch (cloneErr) {
        // Fallback to reading directly
        form = await request.formData();
      }
    } catch (e: any) {
      // If both attempts fail, return a clear JSON error
      const msg = e?.message || String(e);
      if (/already read|body/.test(msg)) {
        return json({ ok: false, error: 'Request body already read and cannot be parsed; please re-try upload' }, 400);
      }
      return json({ ok: false, error: 'Failed to parse multipart form data: ' + msg }, 400);
    }

    const files = form.getAll("files").filter(Boolean) as File[];

    const MAX_REPORTS = Number(process.env.MAX_REPORTS || 4);
    const BUCKET = process.env.GCS_BUCKET || "";
    const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "";
    const LOCATION = (process.env.GCP_LOCATION || "us").toLowerCase();
    const PROCESSOR_ID = process.env.DOC_PROCESSOR_ID || "";

    if (!files.length) return json({ ok: false, error: "No files uploaded" }, 400);
    if (files.length > MAX_REPORTS) return json({ ok: false, error: `Max ${MAX_REPORTS} files allowed` }, 400);

    for (const f of files) {
      const isPdf = /application\/pdf/i.test(f.type) || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return json({ ok: false, error: "Only PDF files are supported" }, 400);
      if (f.size > 25 * 1024 * 1024) return json({ ok: false, error: "Max 25MB per file" }, 400);
    }

    if (!PROJECT_ID || !BUCKET || !PROCESSOR_ID) {
      return json({ ok: false, error: "Missing GCP env: GCP_PROJECT_ID, GCP_LOCATION, DOC_PROCESSOR_ID, GCS_BUCKET" }, 428);
    }

    const endpoint = LOCATION === "eu" ? "eu-documentai.googleapis.com" : "us-documentai.googleapis.com";

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const useExplicitCreds = !!(credsJson && credsJson.trim());

    const storage = useExplicitCreds
      ? new Storage({ projectId: PROJECT_ID, credentials: JSON.parse(credsJson as string) })
      : new Storage({ projectId: PROJECT_ID }); // ADC

    const docai = useExplicitCreds
      ? new DocumentProcessorServiceClient({ projectId: PROJECT_ID, apiEndpoint: endpoint, credentials: JSON.parse(credsJson as string) })
      : new DocumentProcessorServiceClient({ projectId: PROJECT_ID, apiEndpoint: endpoint }); // ADC

    const bucket = storage.bucket(BUCKET);

    const uploaded: Array<{ filename: string; gcsUri: string; contentType: string }> = [];
    const aggregated: any = { files: uploaded };

    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`;
      const gcsFile = bucket.file(unique);
      await gcsFile.save(buf, { contentType: f.type, resumable: false, public: false });
      const gcsUri = `gs://${BUCKET}/${unique}`;
      uploaded.push({ filename: f.name, gcsUri, contentType: f.type });

      try {
        const [result] = await docai.processDocument({
          name: docai.processorPath(PROJECT_ID, LOCATION, PROCESSOR_ID),
          rawDocument: { content: buf, mimeType: f.type || "application/pdf" },
        });
        const text = (result.document?.text || "").replace(/\u0000/g, " ");
        const parsed = extractFromText(text);
        for (const [k, v] of Object.entries(parsed)) if (!(k in aggregated) && v) (aggregated as any)[k] = v;
        if (process.env.NODE_ENV !== "production" && text && !aggregated.text) aggregated.text = text;
      } catch (err: any) {
        aggregated.lastError = err?.message || String(err);
      }
    }

    return json({ ok: true, extracted: aggregated }, 200);
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Extraction failed" }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n");
}

function extractFromText(text: string): Record<string, string> {
  const t = normalize(text);
  const out: Record<string, string> = {};
  const er = /(estrogen receptor|récepteur des œstrogènes|er)\b[^\n]*?(positive|negative|positif|négatif|pos|neg|0%|[1-9]\d?%)/i.exec(t);
  const pr = /(progesterone receptor|récepteur de progestérone|pr)\b[^\n]*?(positive|negative|positif|négatif|pos|neg|0%|[1-9]\d?%)/i.exec(t);
  if (er || pr) {
    const erNeg = er ? /negative|négatif|neg|0%/i.test(er[0]) : false;
    const prNeg = pr ? /negative|négatif|neg|0%/i.test(pr[0]) : false;
    const erStr = er ? (erNeg ? "ER-" : "ER+") : "";
    const prStr = pr ? (prNeg ? "PR-" : "PR+") : "";
    out.ERPR = `${erStr}${erStr && prStr ? "/" : ""}${prStr}`.trim();
    if (er) out.ER = erNeg ? "Negative" : "Positive";
    if (pr) out.PR = prNeg ? "Negative" : "Positive";
  }
  // HER2: capture status and exact score (0/1+/2+/3+)
  let her2 = /(her[- ]?2|her2\/neu)\b[^\n]*?(positive|negative|equivocal|positif|négatif|équivoque|pos|neg|0|1\+|2\+|3\+)/i.exec(t);
  // Patterns like: "HER-2 neu score: NEGATIVE (0 staining)"
  const her2Line = /her[- ]?2[^\n]*?(?:score|result)?[^\n]*?/i.exec(t);
  const her2ScoreInParens = /\((\s*[0-3](?:\s*\+)?\s*stain(?:ing)?\s*)\)/i.exec(her2Line ? her2Line[0] : "");
  const her2Explicit = /her[- ]?2[^\n]*?(positive|negative|equivocal)[^\n]*?(0|1\+|2\+|3\+)?/i.exec(t);

  let her2Score: string | null = null;
  let her2Status: string | null = null;

  if (her2ScoreInParens) {
    const s = her2ScoreInParens[1].toLowerCase();
    if (/3\+/.test(s)) her2Score = '3+'; else if (/2\+/.test(s)) her2Score = '2+'; else if (/1\+/.test(s)) her2Score = '1+'; else if(/\b0\b/.test(s)) her2Score = '0';
  }
  if (her2Explicit) {
    const stat = her2Explicit[1].toLowerCase();
    if (/positif|positive|pos/.test(stat)) her2Status = 'Positive';
    else if (/equivocal|équivoque/.test(stat)) her2Status = 'Equivocal';
    else if (/négatif|negative|neg/.test(stat)) her2Status = 'Negative';
    if (!her2Score && her2Explicit[2]) her2Score = her2Explicit[2].replace(/\s+/g,'');
  }
  if (!her2Status && her2) {
    her2Status = /3\+|positive|positif|pos/i.test(her2[0]) ? 'Positive' : /2\+|equivocal|équivoque/i.test(her2[0]) ? 'Equivocal' : 'Negative';
  }
  if (!her2Score && her2) {
    her2Score = /3\+/.test(her2[0]) ? '3+' : /2\+/.test(her2[0]) ? '2+' : /1\+/.test(her2[0]) ? '1+' : /\b0\b/.test(her2[0]) ? '0' : null;
  }
  if (her2Status) out.HER2 = her2Status;
  if (her2Score) out.HER2Score = her2Score;
  const ki = /(ki[- ]?67)[^\n]*?(\d{1,3})\s*%/i.exec(t); if (ki) out.Ki67 = `${ki[2]}%`;
  const pdl1 = /(pd[- ]?l1)[^\n]*?(positive|negative|positif|négatif|\d{1,3}\s*%)/i.exec(t); if (pdl1) out.PDL1 = pdl1[0].trim();
  const pdl1Pct = /(pd[- ]?l1)[^\n]*?(\d{1,3})\s*%\s*(immune|ic|tumor|tc)?/i.exec(t) || /(ihc score|score ihc)[^\n]*?(\d{1,3})\s*%\s*(immune|ic|tumor|tc)?/i.exec(t); if (pdl1Pct) out.PDL1Percent = `${pdl1Pct[2]}%${pdl1Pct[3] ? " " + pdl1Pct[3].toUpperCase() : ""}`;
  const msi = /(microsatellite\s*instability|instabilité microsatellitaire|msi)[^\n]*?(high|stable|low|élevée|stable|faible)/i.exec(t); if (msi) out.MSI = msi[0].trim();

  // PIK3CA
  const pik = /(pik3ca)[^\n]*?(mutation|mutated|wild[- ]?type|not detected|negative|positive)/i.exec(t);
  if (pik) {
    const stat = pik[2].toLowerCase();
    if (/mutation|mutated|positive/.test(stat)) out.PIK3CA = 'Positive';
    else if (/wild[- ]?type|not detected|negative/.test(stat)) out.PIK3CA = 'Negative';
    out.PIK3CAStatus = out.PIK3CA;
  }

  // BRCA
  const brca = /(brca\s*(1|2)?)[^\n]*?(mutation|mutated|variant|wild[- ]?type|not detected|negative|positive)/i.exec(t);
  if (brca) {
    const stat = brca[3].toLowerCase();
    if (/mutation|mutated|positive|variant/.test(stat)) out.BRCA = 'Positive';
    else if (/wild[- ]?type|not detected|negative/.test(stat)) out.BRCA = 'Negative';
  }

  const st = /\b(?:dcis|stage\s*(0|i{1,3}|iv)|stade\s*(0|i{1,3}|iv))\b/i.exec(t);
  if (st) out.stage = /dcis/i.test(st[0]) ? "DCIS / Stage 0" : `Stage ${(st[1] || st[2] || "").toUpperCase()}`;
  if (/metastatic|metastasis|distant metastases|métastatique|métastases/i.test(t) && !out.stage) out.stage = "Stage IV";
  const mets = /\b(liver|foie|lung|poumon|bone|os|brain|cerveau|adrenal|surr[ée]nale|ovary|ovaire|kidney|rein|pleura|pl[eé]vre|spleen|rate|pancreas|pancr[eé]as|peritoneum|p[eé]ritoine)\b/gi;
  const foundMets = Array.from(t.matchAll(mets)).map((m) => m[0].toLowerCase());
  if (foundMets.length) out.metastasisSites = [...new Set(foundMets)].join(", ");
  const otherMets = /(?:autres sites de m[ée]tastases|autres sites de métastases)[:\s-]*([^\n]+)/i.exec(t) || /other\s*metastatic\s*sites[:\s-]*([^\n]+)/i.exec(t);
  if (otherMets) out.otherMetastasis = otherMets[1].trim();
  const accession = /accession\s*#?\s*[:\-]?\s*([a-z]\d+[a-z0-9\-]*)/i.exec(t) || /patient id\/case number\s*[:\-]?\s*([a-z0-9\-]+)/i.exec(t);
  if (accession) out.accession = accession[1];
  const diagDate = /(date\s*(of\s*)?(report|diagnosis)|date\s*du\s*rapport|date\s*de\s*diagnostic)[^\n]*?(\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b|\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b)/i.exec(t);
  if (diagDate) out.dateOfDiagnosis = diagDate[4];
  const surgDate = /(date\s*of\s*surgery|surgical\s*date|date\s*de\s*(vos\s*)?interventions\s*chirurgicales)[^\n]*?(\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b|\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b)/i.exec(t);
  if (surgDate) out.dateOfSurgery = surgDate[2];
  if (!out.dateOfDiagnosis) {
    const dateRx = /(\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b|\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b)/g; const dates = t.match(dateRx); if (dates?.length) out.dateOfDiagnosis = dates[0];
  }
  return out;
}
