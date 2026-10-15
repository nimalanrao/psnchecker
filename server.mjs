import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exchangeNpssoForAccessCode,
  exchangeCodeForAccessToken,
  getProfileFromAccountId,
  getPurchasedGames,
  getUserPlayedGames
} from "psn-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

// =========================================================================
// SECURITY: Rate limiter to prevent abuse of the fetch API
// =========================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // max 5 fetch requests per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  return false;
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// =========================================================================
// SECURITY: Input validation
// =========================================================================
function isValidNpssoToken(token) {
  // NPSSO tokens are exactly 64 alphanumeric characters
  return typeof token === "string" && /^[A-Za-z0-9]{64}$/.test(token);
}

function sanitizeToken(rawInput) {
  if (!rawInput || typeof rawInput !== "string") return "";
  let token = rawInput.trim().replace(/^["']|["']$/g, "").trim();

  // Handle JSON format: {"npsso": "..."}
  if (token.startsWith("{") && token.includes("npsso")) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.npsso) token = parsed.npsso.trim();
    } catch {}
    const match = token.match(/"npsso"\s*:\s*"([^"]+)"/);
    if (match) token = match[1].trim();
  }

  return token;
}

// =========================================================================
// SECURITY: Set comprehensive security headers on every response
// =========================================================================
function setSecurityHeaders(res) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — disable sensitive APIs
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // Content Security Policy
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://image.api.playstation.com https://store.playstation.com https://*.playstation.net",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'"
  ].join("; "));
  // Strict Transport Security (for HTTPS deployments)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function formatPlayDuration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== "string") return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const totalHours = (hours + minutes / 60).toFixed(1);
  return totalHours > 0 ? `${totalHours}h` : "<1h";
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Detect PS Plus Subscription based on account & library entitlements
function detectPsPlusTier(isPlus, plusGames = []) {
  if (!isPlus) {
    return {
      tier: "None",
      tierLabel: "No Active Subscription",
      tierBadge: "Inactive",
      isPlusActive: false
    };
  }

  return {
    tier: "PS_PLUS",
    tierLabel: "PlayStation Plus",
    tierBadge: "PS PLUS",
    catalogSize: plusGames.length,
    description: "Monthly Games, Online Multiplayer, Exclusive Discounts & Cloud Storage"
  };
}

// Full Fetch Worker with Event Callback & ETA Timer
async function runFetchPipeline(rawToken, onProgress) {
  const startTime = Date.now();

  const emitProgress = (payload) => {
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const pct = payload.percent || 10;
    // Estimate remaining seconds
    let estimatedTotalSec = (elapsedSec / Math.max(pct, 5)) * 100;
    let remainingSec = Math.max(0, Math.round(estimatedTotalSec - elapsedSec));
    if (pct >= 100) remainingSec = 0;

    const remainingText = remainingSec > 0 ? `~${remainingSec}s left` : "finishing...";

    onProgress({
      ...payload,
      elapsedSeconds: elapsedSec,
      remainingSeconds: remainingSec,
      etaText: `${remainingText} (${elapsedSec}s elapsed)`
    });
  };

  // SECURITY: Token has already been sanitized and validated by the caller
  const token = rawToken;

  emitProgress({ step: 1, message: "Connecting to Sony PlayStation OAuth Gateway...", percent: 12 });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("No connection: Connection timed out after 3 seconds.")), 3000)
  );
  const accessCode = await Promise.race([
    exchangeNpssoForAccessCode(token),
    timeoutPromise
  ]);

  emitProgress({ step: 1, message: "Exchanging code for authorized OAuth session...", percent: 24 });
  const auth = await exchangeCodeForAccessToken(accessCode);

  let accountId = null;
  try {
    const jwtPayload = JSON.parse(Buffer.from(auth.accessToken.split(".")[1], "base64").toString());
    accountId = jwtPayload.account_id || jwtPayload.sub;
  } catch {}

  emitProgress({ step: 1, message: "Fetching account profile & PlayStation Plus subscription...", percent: 38 });
  let profile = null;
  if (accountId) {
    try {
      profile = await getProfileFromAccountId(auth, accountId);
    } catch (e) {}
  }

  const onlineId = profile?.onlineId || accountId || "PlayStation User";
  const realName = profile?.personalDetail ? `${profile.personalDetail.firstName || ""} ${profile.personalDetail.lastName || ""}`.trim() : "";
  const isPlus = profile?.isPlus === true;
  const avatarUrl = profile?.avatars?.find(a => a.size === "xl" || a.size === "l")?.url || profile?.avatars?.[0]?.url || null;

  // Step 2: Activity & Playtime
  emitProgress({ step: 2, message: "Analyzing gameplay history & recorded play hours...", percent: 48 });
  const playtimeMap = new Map();
  if (accountId) {
    try {
      let playedOffset = 0;
      const playedLimit = 100;
      while (playedOffset < 300) {
        const playedRes = await getUserPlayedGames(auth, accountId, { limit: playedLimit, offset: playedOffset });
        const titles = playedRes?.titles || [];
        if (!titles.length) break;
        for (const item of titles) {
          const duration = formatPlayDuration(item.playDuration);
          if (item.titleId) {
            playtimeMap.set(item.titleId.toUpperCase(), {
              playtime: duration,
              playCount: item.playCount,
              lastPlayed: item.lastPlayedDateTime
            });
          }
        }
        if (titles.length < playedLimit) break;
        playedOffset += playedLimit;
      }
    } catch (err) {}
  }

  // Step 3: Purchased & Plus Entitlements
  emitProgress({ step: 3, message: "Querying PlayStation Digital Catalog via GraphQL...", percent: 62 });
  let allRawGames = [];
  let start = 0;
  const chunkSize = 100;

  while (true) {
    const res = await getPurchasedGames(auth, { size: chunkSize, start });
    const games = res?.data?.purchasedTitlesRetrieve?.games || [];
    if (games.length === 0) break;
    allRawGames = allRawGames.concat(games);
    
    emitProgress({
      step: 3,
      message: `Retrieved ${allRawGames.length} digital titles from PlayStation catalog...`,
      percent: Math.min(92, 62 + Math.round(allRawGames.length / 4.2))
    });
    if (games.length < chunkSize) break;
    start += chunkSize;
  }

  // Step 4: Classify
  emitProgress({ step: 4, message: "Separating PS5 & PS4 digital licenses & detecting Plus tier...", percent: 96 });
  const normalizedGames = allRawGames.map(g => {
    const titleId = (g.titleId || "").toUpperCase();
    const activity = playtimeMap.get(titleId) || {};
    const isPsPlus = g.membership === "PS_PLUS";
    const platform = (g.platform || "OTHER").toUpperCase();

    return {
      name: g.name || "Unknown Title",
      platform,
      membership: g.membership || "NONE",
      isPsPlus,
      licenseType: isPsPlus ? "PS PLUS CLAIMED" : "OWNED DIGITAL PURCHASE / FREE LICENSE",
      titleId: g.titleId || "",
      entitlementId: g.entitlementId || "",
      productId: g.productId || "",
      isActive: g.isActive ?? true,
      isDownloadable: g.isDownloadable ?? true,
      isPreOrder: g.isPreOrder ?? false,
      playtime: activity.playtime || null,
      playCount: activity.playCount || null,
      lastPlayed: activity.lastPlayed ? activity.lastPlayed.split("T")[0] : null,
      imageUrl: g.image?.url || null
    };
  });

  normalizedGames.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const ownedPS5 = normalizedGames.filter(g => !g.isPsPlus && g.platform === "PS5");
  const ownedPS4 = normalizedGames.filter(g => !g.isPsPlus && g.platform === "PS4");
  const ownedOther = normalizedGames.filter(g => !g.isPsPlus && g.platform !== "PS5" && g.platform !== "PS4");

  const plusPS5 = normalizedGames.filter(g => g.isPsPlus && g.platform === "PS5");
  const plusPS4 = normalizedGames.filter(g => g.isPsPlus && g.platform === "PS4");
  const plusOther = normalizedGames.filter(g => g.isPsPlus && g.platform !== "PS5" && g.platform !== "PS4");

  const totalOwned = ownedPS5.length + ownedPS4.length + ownedOther.length;
  const totalPlus = plusPS5.length + plusPS4.length + plusOther.length;

  const plusGames = normalizedGames.filter(g => g.isPsPlus);
  const plusTierInfo = detectPsPlusTier(isPlus, plusGames);

  const resultData = {
    fetchedAt: new Date().toISOString(),
    account: {
      onlineId,
      realName,
      avatarUrl,
      isPlusActive: isPlus,
      psPlusTier: plusTierInfo.tier,
      psPlusTierLabel: plusTierInfo.tierLabel,
      psPlusTierBadge: plusTierInfo.tierBadge,
      hasGameCatalog: plusTierInfo.hasGameCatalog,
      hasClassicsCatalog: plusTierInfo.hasClassicsCatalog,
      hasGameTrials: plusTierInfo.hasGameTrials,
      hasCloudStreaming: plusTierInfo.hasCloudStreaming,
      psPlusDescription: plusTierInfo.description
    },
    summary: {
      totalTitles: normalizedGames.length,
      ownedPurchases: {
        total: totalOwned,
        ps5: ownedPS5.length,
        ps4: ownedPS4.length,
        other: ownedOther.length
      },
      psPlusEntitlements: {
        total: totalPlus,
        ps5: plusPS5.length,
        ps4: plusPS4.length,
        other: plusOther.length
      }
    },
    games: normalizedGames
  };

  // Write cached files
  fs.writeFileSync(path.join(__dirname, "psn-game-library.json"), JSON.stringify(resultData, null, 2), "utf8");

  const csvHeaders = [
    "Name",
    "Platform",
    "License_Type",
    "Is_PS_Plus",
    "Title_ID",
    "Entitlement_ID",
    "Playtime",
    "Play_Count",
    "Last_Played",
    "Is_Active",
    "Is_Downloadable"
  ];

  const csvRows = normalizedGames.map(g => [
    escapeCsvField(g.name),
    escapeCsvField(g.platform),
    escapeCsvField(g.licenseType),
    escapeCsvField(g.isPsPlus ? "YES" : "NO"),
    escapeCsvField(g.titleId),
    escapeCsvField(g.entitlementId),
    escapeCsvField(g.playtime || ""),
    escapeCsvField(g.playCount ?? ""),
    escapeCsvField(g.lastPlayed || ""),
    escapeCsvField(g.isActive ? "YES" : "NO"),
    escapeCsvField(g.isDownloadable ? "YES" : "NO")
  ].join(","));

  fs.writeFileSync(path.join(__dirname, "psn-game-library.csv"), [csvHeaders.join(","), ...csvRows].join("\r\n"), "utf8");

  emitProgress({
    step: 4,
    message: `Sync Complete! Fetched ${normalizedGames.length} titles in ${Math.round((Date.now() - startTime) / 1000)}s.`,
    percent: 100,
    completed: true,
    data: resultData
  });

  return resultData;
}

// =========================================================================
// SECURITY: Get client IP for rate limiting
// =========================================================================
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         req.socket?.remoteAddress ||
         "unknown";
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientIp = getClientIp(req);

  // SECURITY: Set security headers on every response
  setSecurityHeaders(res);

  // SECURITY: Restrict CORS to same-origin only (no wildcard)
  const origin = req.headers.origin;
  if (origin) {
    // Only allow same-origin requests
    const host = req.headers.host;
    const expectedOrigins = [
      `http://${host}`,
      `https://${host}`,
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`
    ];
    if (expectedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (url.pathname === "/api/library" && req.method === "GET") {
    const jsonPath = path.join(__dirname, "psn-game-library.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, "utf8");
        const parsed = JSON.parse(raw);
        // Ensure tier info is accurate
        if (!parsed.account.psPlusTier || parsed.account.psPlusTier === "PREMIUM" || parsed.account.psPlusTier.includes("Premium")) {
          const tierInfo = detectPsPlusTier(parsed.account.isPlusActive, parsed.games?.filter(g => g.isPsPlus) || []);
          parsed.account.psPlusTier = tierInfo.tier;
          parsed.account.psPlusTierLabel = tierInfo.tierLabel;
          parsed.account.psPlusTierBadge = tierInfo.tierBadge;
          parsed.account.hasGameCatalog = tierInfo.hasGameCatalog;
          parsed.account.hasClassicsCatalog = tierInfo.hasClassicsCatalog;
          parsed.account.hasGameTrials = tierInfo.hasGameTrials;
          parsed.account.hasCloudStreaming = false;
          parsed.account.psPlusDescription = tierInfo.description;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(parsed));
        return;
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to read cached library" }));
        return;
      }
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No cached library found. Run fetch first." }));
      return;
    }
  }

  // SSE Fetch Progress API
  if (url.pathname === "/api/fetch-stream" && req.method === "POST") {
    // SECURITY: Rate limit fetch requests
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many requests. Please wait before trying again." }));
      return;
    }

    // SECURITY: Limit request body size (tokens should never exceed 1KB)
    const MAX_BODY_SIZE = 1024;
    let body = "";
    let bodyTooLarge = false;

    req.on("data", chunk => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        req.destroy();
      }
    });

    req.on("end", async () => {
      if (bodyTooLarge) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large." }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      const sendEvent = (obj) => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      };

      try {
        const parsed = JSON.parse(body || "{}");
        const token = sanitizeToken(parsed.npsso || "");

        if (!token) {
          sendEvent({ error: "Token is empty! Please paste your 64-character PlayStation NPSSO token." });
          res.end();
          return;
        }

        if (token.length < 64) {
          sendEvent({ error: `Wrong token: NPSSO token must be 64 characters (entered ${token.length}).` });
          res.end();
          return;
        }

        // SECURITY: Validate token format
        if (!isValidNpssoToken(token)) {
          sendEvent({ error: "Invalid token format: NPSSO token must be exactly 64 alphanumeric characters." });
          res.end();
          return;
        }

        await runFetchPipeline(token, (prog) => {
          sendEvent(prog);
        });
        res.end();
      } catch (err) {
        let msg = err.message || "Failed to fetch PlayStation library.";
        const lower = msg.toLowerCase();
        if (lower.includes("empty")) {
          msg = "Token is empty! Please paste your 64-character PlayStation NPSSO token.";
        } else if (lower.includes("3 seconds") || lower.includes("timed out") || msg.includes("ENOTFOUND") || msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || lower.includes("network") || lower.includes("econnreset")) {
          msg = "No connection: Connection timed out after 3 seconds or failed to reach Sony PlayStation servers.";
        } else if (lower.includes("64") || msg.includes("NPSSO") || msg.includes("access code") || msg.includes("OAuth") || msg.includes("400") || msg.includes("401") || msg.includes("403") || lower.includes("unauthorized") || lower.includes("invalid") || lower.includes("rejected")) {
          msg = "Wrong token: Authorization was rejected by Sony PlayStation. Please check your token and try again.";
        }
        sendEvent({ error: msg });
        res.end();
      }
    });
    return;
  }

  // Download CSV
  if (url.pathname === "/api/download/csv" && req.method === "GET") {
    const csvPath = path.join(__dirname, "psn-game-library.csv");
    if (fs.existsSync(csvPath)) {
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="psn-game-library.csv"'
      });
      fs.createReadStream(csvPath).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("CSV not found.");
    return;
  }

  // Download JSON
  if (url.pathname === "/api/download/json" && req.method === "GET") {
    const jsonPath = path.join(__dirname, "psn-game-library.json");
    if (fs.existsSync(jsonPath)) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="psn-game-library.json"'
      });
      fs.createReadStream(jsonPath).pipe(res);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("JSON not found.");
    return;
  }

  // Static File Serving
  // SECURITY: Normalize path to prevent directory traversal
  const requestedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, normalizedPath === "/" ? "index.html" : normalizedPath);

  // SECURITY: Ensure the resolved path is within PUBLIC_DIR (prevent path traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedPublicDir = path.resolve(PUBLIC_DIR);
  if (!resolvedPath.startsWith(resolvedPublicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`psn checker running on port ${PORT}!`);
  console.log(`  listening on: 0.0.0.0:${PORT}`);
  console.log(`======================================================\n`);
});
