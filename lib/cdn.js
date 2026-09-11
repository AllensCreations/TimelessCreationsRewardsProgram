/**
 * TCRP Permanent jsDelivr CDN Engine with R2 Edge Acceleration
 */

export const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/AllensCreations/TimelessCreationsRewardsProgram@main/public";

const KNOWN_DRIVE_MAP = {
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

export function getCdnImageUrl(urlOrPath, fallbackName = "image.jpg") {
  if (!urlOrPath || typeof urlOrPath !== "string") {
    return `${JSDELIVR_BASE}/drips/${fallbackName}`;
  }
  let trimmed = urlOrPath.trim();
  if (!trimmed) {
    return `${JSDELIVR_BASE}/drips/${fallbackName}`;
  }

  // Heal stale deleted or previous branch references to main
  if (trimmed.includes("@Appversion") || trimmed.includes("@NewVersion")) {
    trimmed = trimmed.replace(/@(Appversion|NewVersion)/g, "@main");
  }

  // Already a jsDelivr CDN URL
  if (trimmed.includes("cdn.jsdelivr.net")) {
    return trimmed;
  }

  // Relative path in public / drips
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${JSDELIVR_BASE}/${cleanPath}`;
  }

  // Google Drive optimization
  const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    if (KNOWN_DRIVE_MAP[fileId]) {
      return `${JSDELIVR_BASE}/${KNOWN_DRIVE_MAP[fileId]}`;
    }
    return `https://lh3.googleusercontent.com/d/${fileId}=s400`;
  }

  // Postimg default reward map
  if (trimmed.includes("FFdrCNqq")) {
    return `${JSDELIVR_BASE}/drips/default_reward.png`;
  }

  return trimmed;
}
