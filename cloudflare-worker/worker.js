/**
 * FightingLightsV - Cloudflare R2 On-Demand Pull-Through CDN with Auto-Cleanup
 * 
 * Features:
 * 1. Pull-Through Caching: Fetches from permanent storage (jsDelivr / GitHub) on miss, stores in R2.
 * 2. Arbitrary Origin Support: Cache external images (Google Drive, Postimg, etc.) via `?origin=URL`.
 * 3. Auto-Eviction / Cleanup: Deletes unused images older than 30 days on daily cron or via /admin/cleanup.
 * 4. Zero Egress Fees & Free Tier Safe: Streams directly from Cloudflare Manila / Cebu edge.
 */

const PERMANENT_ORIGIN_BASE = "https://cdn.jsdelivr.net/gh/AllensCreations/TimelessCreationsRewardsProgram@Appversion/public";
const DEFAULT_MAX_UNUSED_DAYS = 30; // Auto-delete images unused for 30 days

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+/, ""); // e.g. "assets/drips/temple.jpg"
    const bucket = env.MY_BUCKET || env.BUCKET || env.R2_BUCKET;

    // Root status probe
    if (!pathname) {
      return new Response(
        JSON.stringify({
          service: "FightingLightsV Cloudflare R2 Smart Cache",
          status: "ONLINE",
          bucket_connected: !!bucket,
          permanent_origin: PERMANENT_ORIGIN_BASE,
          auto_cleanup_ttl_days: DEFAULT_MAX_UNUSED_DAYS,
          timestamp: new Date().toISOString()
        }, null, 2),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Manual / Webhook trigger for unused image cleanup
    if (pathname === "admin/cleanup" || pathname === "api/cleanup") {
      const secret = url.searchParams.get("secret") || request.headers.get("x-admin-secret");
      const configuredSecret = env.ADMIN_SECRET || "tcrp-clean-2026";
      if (secret !== configuredSecret) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      const days = parseInt(url.searchParams.get("days") || String(DEFAULT_MAX_UNUSED_DAYS), 10);
      const result = await pruneUnusedR2Objects(bucket, days);
      return new Response(JSON.stringify({ ok: true, ...result }, null, 2), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Check R2 Storage
    if (bucket) {
      try {
        const cachedObj = await bucket.get(pathname);
        if (cachedObj) {
          // Update last-accessed timestamp asynchronously in background (for LRU eviction)
          const nowIso = new Date().toISOString();
          ctx.waitUntil(
            bucket.put(pathname, cachedObj.body, {
              httpMetadata: cachedObj.httpMetadata,
              customMetadata: {
                ...(cachedObj.customMetadata || {}),
                last_accessed: nowIso
              }
            }).catch(() => {})
          );

          const headers = new Headers();
          cachedObj.writeHttpMetadata(headers);
          headers.set("etag", cachedObj.httpEtag);
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("X-Cache-Status", "HIT-R2");

          return new Response(cachedObj.body, { headers });
        }
      } catch (err) {
        console.warn("R2 lookup warning:", err.message);
      }
    }

    // 3. Cache Miss -> Pull from Origin
    let originUrl = url.searchParams.get("origin");
    if (!originUrl) {
      originUrl = `${PERMANENT_ORIGIN_BASE}/${pathname}`;
    }

    try {
      const originRes = await fetch(originUrl, {
        headers: { "User-Agent": "Cloudflare-R2-PullThrough/1.0" }
      });

      if (!originRes.ok) {
        return new Response(`Origin asset not found: ${originRes.status}`, {
          status: originRes.status,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      const contentType = originRes.headers.get("content-type") || "image/jpeg";
      const imageBuffer = await originRes.arrayBuffer();
      const nowIso = new Date().toISOString();

      // 4. Save to R2 in background with metadata for auto-cleanup
      if (bucket) {
        ctx.waitUntil(
          bucket.put(pathname, imageBuffer, {
            httpMetadata: { contentType },
            customMetadata: {
              cached_at: nowIso,
              last_accessed: nowIso,
              origin_url: originUrl
            }
          }).catch(err => console.error("R2 Save Error:", err))
        );
      }

      // 5. Return image immediately
      return new Response(imageBuffer, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Cache-Status": "MISS-STORED-TO-R2"
        }
      });
    } catch (err) {
      return new Response(`Error fetching origin: ${err.message}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  },

  // 6. Scheduled Cron Handler (runs daily at 3:00 AM UTC to auto-delete stale images)
  async scheduled(event, env, ctx) {
    const bucket = env.MY_BUCKET || env.BUCKET || env.R2_BUCKET;
    if (!bucket) return;

    ctx.waitUntil(pruneUnusedR2Objects(bucket, DEFAULT_MAX_UNUSED_DAYS));
  }
};

/**
 * Prune Unused R2 Objects based on last_accessed or uploaded timestamp
 */
async function pruneUnusedR2Objects(bucket, maxUnusedDays = 30) {
  if (!bucket) return { error: "No R2 bucket connected" };

  const cutoffMs = Date.now() - (maxUnusedDays * 24 * 3600 * 1000);
  let totalListed = 0;
  let deletedCount = 0;
  let cursor = undefined;

  do {
    const listResult = await bucket.list({ cursor, limit: 500 });
    totalListed += listResult.objects.length;

    for (const obj of listResult.objects) {
      let isStale = false;
      const lastAccessedStr = obj.customMetadata?.last_accessed || obj.customMetadata?.cached_at;

      if (lastAccessedStr) {
        const lastAccessedTime = new Date(lastAccessedStr).getTime();
        if (!isNaN(lastAccessedTime) && lastAccessedTime < cutoffMs) {
          isStale = true;
        }
      } else if (obj.uploaded && new Date(obj.uploaded).getTime() < cutoffMs) {
        isStale = true;
      }

      if (isStale) {
        await bucket.delete(obj.key).catch(() => {});
        deletedCount++;
      }
    }

    cursor = listResult.truncated ? listResult.cursor : undefined;
  } while (cursor);

  return {
    cutoff_days: maxUnusedDays,
    cutoff_date: new Date(cutoffMs).toISOString(),
    total_scanned: totalListed,
    deleted_stale_images: deletedCount
  };
}
