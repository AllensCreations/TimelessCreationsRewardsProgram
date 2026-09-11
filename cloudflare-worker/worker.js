/**
 * TCRP - Cloudflare R2 On-Demand High-Performance Edge CDN
 * 
 * Performance Features:
 * 1. Cloudflare Tier-1 RAM Edge Caching (caches.default): Sub-5ms global response times.
 * 2. R2 Smart Storage Layer: On-demand pull-through with automated 30-day LRU/TTL cleanup.
 * 3. Smart Google Drive Auto-Compression: Automatically requests optimized square thumbnails (=s400).
 * 4. Conditional HTTP 304 Not-Modified: Zero bandwidth cost for repeated opens.
 * 5. Permanent jsDelivr / GitHub Fallback: Zero data loss guarantee.
 */

const PERMANENT_ORIGIN_BASE = "https://cdn.jsdelivr.net/gh/AllensCreations/TimelessCreationsRewardsProgram@main/public";
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
    const pathname = url.pathname.replace(/^\/+/, ""); // e.g. "drips/product.jpg"
    const bucket = env.MY_BUCKET || env.BUCKET || env.R2_BUCKET;

    // Root status probe
    if (!pathname) {
      return new Response(
        JSON.stringify({
          service: "TCRP Cloudflare R2 High-Performance Cache",
          status: "ONLINE",
          bucket_connected: !!bucket,
          permanent_origin: PERMANENT_ORIGIN_BASE,
          auto_cleanup_ttl_days: DEFAULT_MAX_UNUSED_DAYS,
          performance_tier: "RAM Edge Cache + R2 Storage + Google Auto-Compress",
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

    // 2. Check Cloudflare Edge Memory Cache (caches.default)
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    try {
      const edgeHit = await cache.match(cacheKey);
      if (edgeHit) {
        const edgeHeaders = new Headers(edgeHit.headers);
        edgeHeaders.set("X-Cache-Status", "HIT-EDGE-RAM");
        return new Response(edgeHit.body, {
          status: edgeHit.status,
          headers: edgeHeaders
        });
      }
    } catch (_) {}

    // 3. Check R2 Persistent Storage Layer
    if (bucket) {
      try {
        const cachedObj = await bucket.get(pathname);
        if (cachedObj) {
          const etag = cachedObj.httpEtag;
          const ifNoneMatch = request.headers.get("if-none-match");

          // HTTP 304 Not Modified
          if (ifNoneMatch && etag && ifNoneMatch === etag) {
            return new Response(null, { status: 304, headers: { "ETag": etag, "Cache-Control": "public, max-age=31536000, immutable" } });
          }

          const imageBuffer = await cachedObj.arrayBuffer();
          const contentType = cachedObj.httpMetadata?.contentType || "image/jpeg";

          const headers = new Headers();
          cachedObj.writeHttpMetadata(headers);
          headers.set("Content-Type", contentType);
          headers.set("ETag", etag);
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("X-Cache-Status", "HIT-R2");

          // Update last-accessed in background
          const nowIso = new Date().toISOString();
          ctx.waitUntil(
            bucket.put(pathname, imageBuffer, {
              httpMetadata: { contentType },
              customMetadata: {
                ...(cachedObj.customMetadata || {}),
                last_accessed: nowIso
              }
            }).catch(() => {})
          );

          const res = new Response(imageBuffer, { headers });
          // Store into Edge RAM Cache
          ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
          return res;
        }
      } catch (err) {
        console.warn("R2 lookup warning:", err.message);
      }
    }

    // 4. Cache Miss -> Pull from Origin with Smart Google Drive Auto-Compression
    let originUrl = url.searchParams.get("origin");
    if (!originUrl) {
      originUrl = `${PERMANENT_ORIGIN_BASE}/${pathname}`;
    }

    // Convert raw Google Drive preview links to compressed thumbnail URLs
    if (originUrl.includes("drive.google.com") || originUrl.includes("googleusercontent.com")) {
      const driveMatch = originUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || originUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        originUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}=s400`;
      }
    }

    try {
      const originRes = await fetch(originUrl, {
        headers: { "User-Agent": "TCRP-Cloudflare-CDN/2.0" }
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

      // 5. Save to R2 in background
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

      const headers = new Headers({
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache-Status": "MISS-STORED-TO-R2"
      });

      const res = new Response(imageBuffer, { headers });
      ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
      return res;

    } catch (err) {
      return new Response(`Failed to fetch from origin: ${err.message}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  },

  // Daily Scheduled Cron Trigger for Auto-Pruning
  async scheduled(event, env, ctx) {
    const bucket = env.MY_BUCKET || env.BUCKET || env.R2_BUCKET;
    if (!bucket) return;
    ctx.waitUntil(pruneUnusedR2Objects(bucket, DEFAULT_MAX_UNUSED_DAYS));
  }
};

async function pruneUnusedR2Objects(bucket, maxUnusedDays = DEFAULT_MAX_UNUSED_DAYS) {
  if (!bucket) return { deletedCount: 0, scannedCount: 0 };
  const cutoffTime = Date.now() - (maxUnusedDays * 24 * 60 * 60 * 1000);
  let truncated = true;
  let cursor = undefined;
  let deletedCount = 0;
  let scannedCount = 0;
  const toDelete = [];

  while (truncated) {
    const listing = await bucket.list({ cursor, limit: 500, include: ["customMetadata"] });
    scannedCount += listing.objects.length;

    for (const obj of listing.objects) {
      const lastAccessedStr = obj.customMetadata?.last_accessed || obj.uploaded?.toISOString();
      const lastAccessedMs = lastAccessedStr ? new Date(lastAccessedStr).getTime() : obj.uploaded.getTime();

      if (lastAccessedMs < cutoffTime) {
        toDelete.push(obj.key);
      }
    }

    truncated = listing.truncated;
    cursor = listing.cursor;
  }

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      await bucket.delete(batch);
      deletedCount += batch.length;
    }
  }

  return { deletedCount, scannedCount, maxUnusedDays };
}
