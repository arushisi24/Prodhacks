"use client";

import { useState } from "react";

export default function UploadDocButton({
  docType,
  onSaved,
}: {
  docType: string;
  onSaved?: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1) Upload to Blob via your existing server route
      const form = new FormData();
      form.append("file", file);
      form.append("docType", docType);

      const up = await fetch("/api/upload", { method: "POST", body: form });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error || "Upload failed");

      // 2) Save returned URL in session cookie
      const save = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docType, url: upJson.url }),
      });
      const saveJson = await save.json();
      if (!save.ok) throw new Error(saveJson.error || "Save failed");

      onSaved?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <label className="btn" style={{ cursor: "pointer", display: "inline-block" }}>
      {uploading ? "Uploading..." : "Upload file"}
      <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onPick} />
    </label>
  );
}
