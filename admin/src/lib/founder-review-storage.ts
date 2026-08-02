import "server-only";

import manifest from "@/content/founder-review-manifest.json";
import { getSupabaseAdmin } from "@core/supabase";

type ReviewFile = {
  source: string;
  sha256: string;
  storagePath: string;
  contentType: string;
  download: boolean;
};

export const FOUNDER_REVIEW_VERSION = manifest.version;

export function getFounderReviewFile(filename: string): ReviewFile | null {
  if (!Object.hasOwn(manifest.files, filename)) return null;
  return manifest.files[filename as keyof typeof manifest.files] as ReviewFile;
}

export async function getFounderReviewHtml(): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(manifest.bucket)
    .download(manifest.deck.storagePath);

  if (error || !data) {
    throw new Error(error?.message || "Founder review deck is unavailable");
  }

  return data.text();
}

export async function createFounderReviewFileUrl(
  filename: string,
  file: ReviewFile
): Promise<string> {
  const options = file.download ? { download: filename } : undefined;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(manifest.bucket)
    .createSignedUrl(file.storagePath, 60, options);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not authorize that file");
  }

  return data.signedUrl;
}
