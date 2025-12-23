import { serveDir } from "@std/http/file-server";
import { normalize } from "@std/path";

// 📊 Open Deno KV database for visitor tracking
const kv = await Deno.openKv();

// 📝 Visitor tracking interface
interface VisitorLog {
  timestamp: number;
  ip: string;
  userAgent: string | null;
  referer: string | null;
  origin: string | null;
  country: string | null;
  path: string;
  method: string;
}

// 🔍 Log visitor with privacy compliance
async function logVisitor(req: Request): Promise<void> {
  const headers = req.headers;
  
  // ✅ Respect Do Not Track header
  const dnt = headers.get("dnt") || headers.get("DNT");
  if (dnt === "1") {
    return; // Don't track if user has DNT enabled
  }

  const url = new URL(req.url);
  const timestamp = Date.now();
  
  const visitor: VisitorLog = {
    timestamp,
    ip: headers.get("cf-connecting-ip") || 
        headers.get("x-forwarded-for") || 
        headers.get("x-real-ip") || 
        "unknown",
    userAgent: headers.get("user-agent"),
    referer: headers.get("referer"),
    origin: headers.get("origin"),
    country: headers.get("cf-ipcountry"), // Cloudflare provides this
    path: url.pathname,
    method: req.method,
  };

  // 💾 Store visit data with timestamp-based key
  await kv.set(["visits", timestamp], visitor);
  
  // 📊 Update counters
  const date = new Date(timestamp);
  
  // Daily: YYYY-MM-DD
  const dateKey = date.toISOString().split("T")[0];
  const dailyCount = await kv.get<number>(["daily", dateKey]);
  await kv.set(["daily", dateKey], (dailyCount.value || 0) + 1);
  
  // Weekly: YYYY-WW (ISO week number)
  const weekKey = getISOWeek(date);
  const weeklyCount = await kv.get<number>(["weekly", weekKey]);
  await kv.set(["weekly", weekKey], (weeklyCount.value || 0) + 1);
  
  // Monthly: YYYY-MM
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const monthlyCount = await kv.get<number>(["monthly", monthKey]);
  await kv.set(["monthly", monthKey], (monthlyCount.value || 0) + 1);
}

// 📅 Get ISO week number (YYYY-WW format)
function getISOWeek(date: Date): string {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

// 📈 Get visitor statistics
async function getStats(limit = 100): Promise<{
  totalVisits: number;
  recentVisits: VisitorLog[];
  dailyStats: Record<string, number>;
  weeklyStats: Record<string, number>;
  monthlyStats: Record<string, number>;
  topReferers: Record<string, number>;
  topCountries: Record<string, number>;
  topPaths: Record<string, number>;
}> {
  const recentVisits: VisitorLog[] = [];
  const refererCount: Record<string, number> = {};
  const countryCount: Record<string, number> = {};
  const pathCount: Record<string, number> = {};
  
  // 📋 Get recent visits (limit to last N visits)
  const entries = kv.list<VisitorLog>({ prefix: ["visits"] }, { 
    limit,
    reverse: true // Most recent first
  });
  
  let totalVisits = 0;
  for await (const entry of entries) {
    totalVisits++;
    const visit = entry.value;
    recentVisits.push(visit);
    
    // Count referers
    const referer = visit.referer || "direct";
    refererCount[referer] = (refererCount[referer] || 0) + 1;
    
    // Count countries
    if (visit.country) {
      countryCount[visit.country] = (countryCount[visit.country] || 0) + 1;
    }
    
    // Count paths
    pathCount[visit.path] = (pathCount[visit.path] || 0) + 1;
  }
  
  // 📅 Get daily stats
  const dailyStats: Record<string, number> = {};
  const dailyEntries = kv.list<number>({ prefix: ["daily"] });
  for await (const entry of dailyEntries) {
    const date = entry.key[1] as string;
    dailyStats[date] = entry.value;
  }
  
  // 📅 Get weekly stats
  const weeklyStats: Record<string, number> = {};
  const weeklyEntries = kv.list<number>({ prefix: ["weekly"] });
  for await (const entry of weeklyEntries) {
    const week = entry.key[1] as string;
    weeklyStats[week] = entry.value;
  }
  
  // 📅 Get monthly stats
  const monthlyStats: Record<string, number> = {};
  const monthlyEntries = kv.list<number>({ prefix: ["monthly"] });
  for await (const entry of monthlyEntries) {
    const month = entry.key[1] as string;
    monthlyStats[month] = entry.value;
  }

  return {
    totalVisits,
    recentVisits,
    dailyStats,
    weeklyStats,
    monthlyStats,
    topReferers: refererCount,
    topCountries: countryCount,
    topPaths: pathCount,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const rawPath = url.pathname;

  // 📊 API endpoint for visitor statistics
  if (rawPath === "/api/stats") {
    try {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const stats = await getStats(limit);
      
      return new Response(JSON.stringify(stats, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Allow dashboard to access
        },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: "Failed to fetch stats" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 🔒 1. Reject suspicious paths early
  const lowered = rawPath.toLowerCase();
  if (
    lowered.includes("..") ||
    lowered.includes("%2e") // catches %2e, %2e%2e, etc.
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  // 🔒 2. Normalize path (defensive)
  const safePath = normalize(rawPath);
  if (!safePath.startsWith("/")) {
    return new Response("Forbidden", { status: 403 });
  }

  // 📝 Log visitor (async, don't block response)
  logVisitor(req).catch(err => console.error("Failed to log visitor:", err));

  // 📦 3. Serve static files securely
  return serveDir(req, {
    fsRoot: "./public",
    showDirListing: false, // ❌ disable directory listings
    quiet: true,
  });
});
