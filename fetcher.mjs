import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import {
  exchangeNpssoForAccessCode,
  exchangeCodeForAccessToken,
  getProfileFromAccountId,
  getPurchasedGames,
  getUserPlayedGames
} from "psn-api";

const rl = readline.createInterface({ input, output });

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Visual Progress Bar
function printProgressBar(current, total, label = "Fetching games") {
  const barWidth = 30;
  if (total > 0) {
    const pct = Math.min(1, current / total);
    const filled = Math.round(barWidth * pct);
    const barStr = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const pctText = `${Math.round(pct * 100)}%`.padStart(4);
    output.write(`\r[${barStr}] ${pctText} | ${label} (${current}/${total})`);
  } else {
    const anim = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const frame = anim[current % anim.length];
    const filled = Math.min(barWidth, Math.max(1, (current % (barWidth + 1))));
    const barStr = "█".repeat(filled) + "░".repeat(barWidth - filled);
    output.write(`\r${frame} [${barStr}] | ${label} (${current} retrieved)`);
  }
}

function clearProgressLine() {
  output.write("\r" + " ".repeat(85) + "\r");
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

function cleanTokenInput(raw) {
  let token = raw.trim();
  // Strip quotes if user pasted with quotes
  token = token.replace(/^["']|["']$/g, "").trim();
  // If user pasted full JSON like {"npsso":"xxx"}
  if (token.startsWith("{") && token.includes("npsso")) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.npsso) return parsed.npsso.trim();
    } catch {}
    const match = token.match(/"npsso"\s*:\s*"([^"]+)"/);
    if (match) return match[1].trim();
  }
  return token;
}

function printGameTable(title, games) {
  console.log(`\n================================================================================`);
  console.log(` ${title} (${games.length} titles)`);
  console.log(`================================================================================`);
  if (games.length === 0) {
    console.log("  (None found)");
    return;
  }

  // Print neatly formatted rows
  games.forEach((g, idx) => {
    const num = String(idx + 1).padStart(3, " ");
    const plat = `[${g.platform}]`.padEnd(7, " ");
    const playInfo = g.playtime ? `| Playtime: ${g.playtime}` : "";
    const titleIdInfo = g.titleId ? `(${g.titleId})` : "";
    console.log(` ${num}. ${plat} ${g.name} ${titleIdInfo} ${playInfo}`);
  });
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                 PSN GAME FETCHER CLI v2.0                      ║");
  console.log("║     Authentic PlayStation Network Digital Library Scanner      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Check argument or env or prompt
  const args = process.argv.slice(2);
  let npsso = "";

  const tokenArgIdx = args.findIndex(a => a === "--token" || a === "-t");
  if (tokenArgIdx !== -1 && args[tokenArgIdx + 1]) {
    npsso = args[tokenArgIdx + 1];
  } else if (process.env.NPSSO) {
    npsso = process.env.NPSSO;
  } else {
    npsso = await question("Enter your NPSSO token here: ");
  }

  npsso = cleanTokenInput(npsso);
  rl.close();

  if (!npsso) {
    console.error("\n[!] Error: No NPSSO token provided. Exiting.");
    process.exitCode = 1;
    return;
  }

  try {
    // Step 1: Authentication
    console.log("\n[1/4] Connecting & Authenticating with PlayStation Network...");
    printProgressBar(1, 4, "Exchanging NPSSO for access code");
    const accessCode = await exchangeNpssoForAccessCode(npsso);
    
    printProgressBar(2, 4, "Exchanging access code for OAuth tokens");
    const auth = await exchangeCodeForAccessToken(accessCode);

    // Decode account ID from JWT
    let accountId = null;
    try {
      const jwtPayload = JSON.parse(Buffer.from(auth.accessToken.split('.')[1], 'base64').toString());
      accountId = jwtPayload.account_id || jwtPayload.sub;
    } catch {}

    printProgressBar(3, 4, "Fetching PSN profile details");
    let profile = null;
    if (accountId) {
      try {
        profile = await getProfileFromAccountId(auth, accountId);
      } catch (e) {
        // Fallback gracefully if profile endpoint has a temporary hiccup
      }
    }
    printProgressBar(4, 4, "Authentication complete!");
    clearProgressLine();

    const onlineId = profile?.onlineId || accountId || "PlayStation User";
    const realName = profile?.personalDetail ? `${profile.personalDetail.firstName || ""} ${profile.personalDetail.lastName || ""}`.trim() : "";
    const isPlus = profile?.isPlus === true;

    console.log("\n--- ACCOUNT PROFILE ---");
    console.log(` Online ID   : ${onlineId}`);
    if (realName) console.log(` Name        : ${realName}`);
    console.log(` PS Plus     : ${isPlus ? "ACTIVE (YES)" : "INACTIVE (NO)"}`);
    console.log("-----------------------\n");

    // Step 2: Fetch playtime data (if available) to enrich titles
    console.log("[2/4] Fetching playtime and recent activity stats...");
    const playtimeMap = new Map();
    if (accountId) {
      try {
        let playedOffset = 0;
        const playedLimit = 100;
        let playedFetched = 0;
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
          playedFetched += titles.length;
          printProgressBar(playedFetched, 0, "Scanning played activity");
          if (titles.length < playedLimit) break;
          playedOffset += playedLimit;
        }
        clearProgressLine();
        console.log(`✓ Cached activity stats for ${playtimeMap.size} titles.`);
      } catch (err) {
        clearProgressLine();
        console.log("ℹ Note: Activity stats unavailable or private; proceeding with library fetch.");
      }
    }

    // Step 3: Fetch Full Digital Purchased & Claimed Library
    console.log("\n[3/4] Fetching digital library (Purchased & PS Plus claims)...");
    let allRawGames = [];
    let start = 0;
    const chunkSize = 100;

    while (true) {
      printProgressBar(allRawGames.length, 0, "Retrieving game catalog");
      const res = await getPurchasedGames(auth, { size: chunkSize, start });
      const games = res?.data?.purchasedTitlesRetrieve?.games || [];
      if (games.length === 0) break;
      
      allRawGames = allRawGames.concat(games);
      printProgressBar(allRawGames.length, 0, "Retrieving game catalog");
      
      if (games.length < chunkSize) break;
      start += chunkSize;
    }
    clearProgressLine();
    console.log(`✓ Finished fetching: ${allRawRawCount(allRawGames)} digital title entries retrieved!`);

    // Step 4: Classify and Separate Games
    console.log("\n[4/4] Categorizing titles by Platform and Ownership Type...");

    const normalizedGames = allRawGames.map(g => {
      const titleId = (g.titleId || "").toUpperCase();
      const activity = playtimeMap.get(titleId) || {};
      const isPsPlus = g.membership === "PS_PLUS";
      const platform = (g.platform || "OTHER").toUpperCase();

      return {
        name: g.name || "Unknown Title",
        platform: platform,
        membership: g.membership || "NONE",
        isPsPlus: isPsPlus,
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

    // Sort alphabetically by name
    normalizedGames.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    // Grouping
    const ownedPS5 = normalizedGames.filter(g => !g.isPsPlus && g.platform === "PS5");
    const ownedPS4 = normalizedGames.filter(g => !g.isPsPlus && g.platform === "PS4");
    const ownedOther = normalizedGames.filter(g => !g.isPsPlus && g.platform !== "PS5" && g.platform !== "PS4");

    const plusPS5 = normalizedGames.filter(g => g.isPsPlus && g.platform === "PS5");
    const plusPS4 = normalizedGames.filter(g => g.isPsPlus && g.platform === "PS4");
    const plusOther = normalizedGames.filter(g => g.isPsPlus && g.platform !== "PS5" && g.platform !== "PS4");

    // Display Categories Clearly
    printGameTable("OWNED DIGITAL PURCHASES — PLAYSTATION 5", ownedPS5);
    printGameTable("OWNED DIGITAL PURCHASES — PLAYSTATION 4", ownedPS4);
    if (ownedOther.length) {
      printGameTable("OWNED DIGITAL PURCHASES — OTHER PLATFORMS", ownedOther);
    }

    printGameTable("PS PLUS SUBSCRIPTION ENTITLEMENTS — PLAYSTATION 5", plusPS5);
    printGameTable("PS PLUS SUBSCRIPTION ENTITLEMENTS — PLAYSTATION 4", plusPS4);
    if (plusOther.length) {
      printGameTable("PS PLUS SUBSCRIPTION ENTITLEMENTS — OTHER PLATFORMS", plusOther);
    }

    // Summary Box
    const totalOwned = ownedPS5.length + ownedPS4.length + ownedOther.length;
    const totalPlus = plusPS5.length + plusPS4.length + plusOther.length;

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║                      LIBRARY SUMMARY                           ║`);
    console.log(`╠════════════════════════════════════════════════════════════════╣`);
    console.log(`║ Total Digital Titles Found       : ${String(normalizedGames.length).padEnd(28)}║`);
    console.log(`║ ─── OWNED DIGITAL LICENSES       : ${String(totalOwned).padEnd(28)}║`);
    console.log(`║     • PS5 Owned Games            : ${String(ownedPS5.length).padEnd(28)}║`);
    console.log(`║     • PS4 Owned Games            : ${String(ownedPS4.length).padEnd(28)}║`);
    console.log(`║ ─── PS PLUS CLAIMED TITLES       : ${String(totalPlus).padEnd(28)}║`);
    console.log(`║     • PS5 PS Plus Games          : ${String(plusPS5.length).padEnd(28)}║`);
    console.log(`║     • PS4 PS Plus Games          : ${String(plusPS4.length).padEnd(28)}║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    // Export JSON
    const jsonOutput = {
      fetchedAt: new Date().toISOString(),
      account: {
        onlineId,
        realName,
        isPlusActive: isPlus,
        psPlusTier: isPlus ? "DELUXE" : "None",
        psPlusTierLabel: isPlus ? "PlayStation Plus Deluxe" : "No Active Subscription",
        psPlusTierBadge: isPlus ? "✦ DELUXE" : "Inactive"
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

    const jsonPath = "psn-game-library.json";
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), "utf8");
    console.log(`[✓] JSON saved to: ${jsonPath}`);

    // Export CSV
    const csvPath = "psn-game-library.csv";
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

    fs.writeFileSync(csvPath, [csvHeaders.join(","), ...csvRows].join("\r\n"), "utf8");
    console.log(`[✓] CSV saved to:  ${csvPath}`);
    console.log("\nDone! You can open 'psn-game-library.csv' directly in Excel or Google Sheets.");

  } catch (error) {
    clearProgressLine();
    console.error("\n❌ Fetch failed!");
    console.error("Error details:", error?.message || error);
    console.error("\nTroubleshooting tips:");
    console.error(" 1. NPSSO tokens expire periodically. Make sure your NPSSO is fresh.");
    console.error(" 2. To get a fresh NPSSO:");
    console.error("    - Log into https://www.playstation.com in your web browser.");
    console.error("    - Visit https://ca.account.sony.com/api/v1/ssocookie in the same browser.");
    console.error("    - Copy the 64-character \"npsso\" token value.");
    process.exitCode = 1;
  }
}

function allRawRawCount(arr) {
  return arr.length;
}

main();
