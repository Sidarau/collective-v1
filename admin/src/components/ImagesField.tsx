"use client";

import { useRef, useState } from "react";

interface Props {
  /** Form field name; submits JSON array (or plain URL string when single). */
  name: string;
  initial: string[];
  single?: boolean;
  label?: string;
}

/**
 * Photo manager for editor forms: upload to /api/media or paste a URL.
 * Serialises into a hidden input so plain server-action forms keep working.
 */
export default function ImagesField({ name, initial, single = false, label }: Props) {
  const [urls, setUrls] = useState<string[]>(initial.filter(Boolean));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (url: string) => {
    if (!url) return;
    setUrls((prev) => (single ? [url] : prev.includes(url) ? prev : [...prev, url]));
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setPending(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        add(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      {label && <p className="label">{label}</p>}
      <input type="hidden" name={name} value={single ? urls[0] || "" : JSON.stringify(urls)} />

      {urls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-20 w-28 rounded-md border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => setUrls((prev) => prev.filter((u) => u !== url))}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-line bg-base text-[10px] text-red group-hover:flex"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={!single}
          onChange={(e) => upload(e.target.files)}
          className="hidden"
          id={`file-${name}`}
        />
        <label htmlFor={`file-${name}`} className="btn cursor-pointer">
          {pending ? "Uploading…" : "Upload photo"}
        </label>
        <input
          className="input flex-1"
          placeholder="…or paste an image URL"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            add(pasted.trim());
            setPasted("");
          }}
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px] text-red">{error}</p>}
    </div>
  );
}
