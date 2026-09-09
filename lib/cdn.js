/**
 * TCRP Cloudflare R2 Edge CDN Helper
 * Routes images through the Cloudflare R2 Smart Cache Worker
 */

export const R2_WORKER_BASE = "https://fightinglightsv2.2ndsalviejomark2019.workers.dev";

export function getCdnImageUrl(urlOrPath, fallbackName = "image.jpg") {
  if (!urlOrPath || typeof urlOrPath !== 'string') return `${R2_WORKER_BASE}/${fallbackName}`;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return `${R2_WORKER_BASE}/${fallbackName}`;
  if (trimmed.startsWith(R2_WORKER_BASE)) return trimmed;

  // Local / relative path in public
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${R2_WORKER_BASE}/${cleanPath}`;
  }

  // External URL (e.g. Google Drive, Postimg)
  // Extract a clean filename key from the ID/URL
  let fileKey = "asset";
  const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    fileKey = `drive_${driveMatch[1]}`;
  } else {
    fileKey = `ext_${trimmed.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-24)}`;
  }

  const ext = trimmed.includes('.png') ? '.png' : (trimmed.includes('.webp') ? '.webp' : '.jpg');
  return `${R2_WORKER_BASE}/drips/${fileKey}${ext}?origin=${encodeURIComponent(trimmed)}`;
}
