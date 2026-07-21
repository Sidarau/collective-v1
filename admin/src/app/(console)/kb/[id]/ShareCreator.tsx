"use client";

import { useActionState } from "react";
import { createShareAction, type ShareResult } from "@/lib/kb-publish-actions";

const initial: ShareResult = { ok: false };

/**
 * External-share creator. The generated URL + password are shown exactly once
 * (returned straight to the client via the action result — never persisted in
 * plaintext, never in a URL). The operator copies them and delivers them out
 * of band.
 */
export default function ShareCreator({ nodeId, canShare }: { nodeId: string; canShare: boolean }) {
  const [state, action, pending] = useActionState(createShareAction, initial);

  if (!canShare) {
    return (
      <p className="text-[12px] text-faint">
        Publish this doc first — external shares point at the published revision.
      </p>
    );
  }

  return (
    <div>
      {state.ok && state.url ? (
        <div className="rounded-lg border border-gold/50 bg-gold/5 p-3">
          <p className="label mb-1 text-gold">Share created — copy now, shown once</p>
          <p className="mb-2 text-[12px] text-muted">
            For {state.recipient}. Send the link and password separately.
          </p>
          <label className="label">Link</label>
          <code className="mb-2 block break-all rounded bg-base px-2 py-1 text-[12px] text-ink">{state.url}</code>
          <label className="label">Password</label>
          <code className="block break-all rounded bg-base px-2 py-1 text-[12px] text-ink">{state.password}</code>
        </div>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="id" value={nodeId} />
          {state.error && <p className="text-[12px] text-red">{state.error}</p>}
          <div>
            <label className="label">Recipient (label only)</label>
            <input name="recipient" required className="input" placeholder="e.g. Investor — J. Doe" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Password (blank = auto)</label>
              <input name="password" className="input" placeholder="auto-generated" />
            </div>
            <div>
              <label className="label">Expires (days)</label>
              <input name="expiresDays" type="number" min="1" className="input" placeholder="none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Max views</label>
              <input name="maxViews" type="number" min="1" className="input" placeholder="unlimited" />
            </div>
            <label className="mt-6 flex items-center gap-2 text-[12px] text-muted">
              <input type="checkbox" name="watermark" className="accent-[#e0bd73]" /> Watermark
            </label>
          </div>
          <button type="submit" disabled={pending} className="btn btn-gold w-full">
            {pending ? "Creating…" : "Create share link"}
          </button>
        </form>
      )}
    </div>
  );
}
