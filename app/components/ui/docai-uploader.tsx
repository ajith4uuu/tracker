import { useRef, useState } from "react";
import { consoleError, consoleLog } from "~/lib/utils";

type ExtractResult = {
  ok: boolean;
  error?: string;
  extracted?: any;
};

export default function DocAIUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const filtered = list.filter((f) => (f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf")) && f.size <= 25 * 1024 * 1024);
    setFiles(filtered.slice(0, 4));
  };

  const onUpload = async () => {
    try {
      setBusy(true);
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const r = await fetch("/api/docai/extract", { method: "POST", body: fd });
      const data: ExtractResult = await r.json();
      if (!data.ok) throw new Error(data.error || "Upload failed");
      setResult(data.extracted);
    } catch (e: any) {
      consoleError("DocAI upload failed:", e);
      alert(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-4">
      <header className="card-header">
        <p className="card-header-title">Upload pathology report(s)</p>
      </header>
      <div className="card-content">
        <div className="content">
          <p>Select up to 4 PDF files (max 25MB each). Files are stored securely and discarded after submission.</p>
          <div className="file has-name is-fullwidth mt-3">
            <label className="file-label">
              <input ref={inputRef} className="file-input" type="file" accept="application/pdf" multiple onChange={onPick} />
              <span className="file-cta"><span className="file-label">Choose PDFs…</span></span>
              <span className="file-name">{files.length ? files.map(f=>f.name).join(", ") : "No file selected"}</span>
            </label>
          </div>
          <button className="btn-theme mt-3" disabled={!files.length || busy} onClick={onUpload}>
            {busy ? "Uploading…" : "Upload & Extract"}
          </button>
          {result && (
            <div className="notification is-info is-light mt-4">
              <strong>Detected:</strong>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
