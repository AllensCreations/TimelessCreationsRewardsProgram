/**
 * TCRP jsDelivr + Cloudflare R2 Edge CDN Engine
 * Storage Origin: jsDelivr (GitHub Appversion branch)
 * Edge Cache: Cloudflare R2 Smart Cache Worker
 */

export const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/AllensCreations/TimelessCreationsRewardsProgram@Appversion/public";
export const R2_WORKER_BASE = (typeof process !== "undefined" && process.env && process.env.R2_WORKER_URL) || "https://tcrp.2ndsalviejomark2019.workers.dev";

export function getCdnImageUrl(urlOrPath, fallbackName = "image.jpg") {
  if (!urlOrPath || typeof urlOrPath !== "string") {
    return `${JSDELIVR_BASE}/drips/${fallbackName}`;
  }
  const trimmed = urlOrPath.trim();
  if (!trimmed) {
    return `${JSDELIVR_BASE}/drips/${fallbackName}`;
  }

  // Already wrapped
  if (trimmed.startsWith(R2_WORKER_BASE) || trimmed.startsWith(JSDELIVR_BASE)) {
    return trimmed;
  }

  // Relative path in public / drips
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${JSDELIVR_BASE}/${cleanPath}`;
  }

  // Google Drive optimization: extract file ID
  const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    // Map known default asset IDs to direct jsDelivr files
    const knownMap = {
      "1IkagW3wWhIhfaG01mBL4wNF-1j2lP6YG": "drips/temple_hero.jpg",
      "1F7Yb0OzuCmPO2LyZ0cMoaTM4d4rs5RFE": "drips/essential_nametag.jpg",
      "101jY71PjxCwiuNznTgn7Xyc0HoXwB3WQ": "drips/essential_pos_kit.jpg",
      "1ZTR6vYPZu4jMmII6ZmxzIO2jD_Q2qZex": "drips/grid_1.jpg",
      "1x3BSmnhCH0MhEhmFKqfL3gctnljtY_Ky": "drips/grid_2.jpg",
      "1r6i_IK3P2oYjBLlI-ZiX2Vd7Rty2Phrv": "drips/grid_3.jpg",
      "1dRn6RIZd1Glv0kj3gduyO7TPJ3gbboeR": "drips/grid_4.jpg",
      "1PceqCmTOvYosSGb9h_tWiqk_qSIIZb4m": "drips/grid_5.jpg",
      "1FZ1hppzB5QWAAJRx5mdHUfFAwx9nMVqV": "drips/grid_6.jpg",
      "1ClRvFGc7yUwM03ydd1fb8XwGE1NXWKvY": "drips/grid_7.jpg",
      "15fj9X-Epr_MFvgHuf5PFl0d1Syu4HYJI": "drips/grid_8.jpg",
      "1gGDswVZRyCMnzmdRMWg_Ue4HW7Msi1qC": "drips/grid_9.jpg"
    };

    if (knownMap[fileId]) {
      return `${JSDELIVR_BASE}/${knownMap[fileId]}`;
    }

    const compressedDrive = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
    return `${R2_WORKER_BASE}/drips/drive_${fileId}.jpg?origin=${encodeURIComponent(compressedDrive)}`;
  }

  // Postimg default reward map
  if (trimmed.includes("FFdrCNqq")) {
    return `${JSDELIVR_BASE}/drips/default_reward.png`;
  }

  // Arbitrary external URL
  const fileKey = `ext_${trimmed.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-24)}`;
  const ext = trimmed.includes(".png") ? ".png" : (trimmed.includes(".webp") ? ".webp" : ".jpg");
  return `${R2_WORKER_BASE}/drips/${fileKey}${ext}?origin=${encodeURIComponent(trimmed)}`;
}
