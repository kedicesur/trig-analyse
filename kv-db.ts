/// <reference lib="deno.unstable" />

// 📊 Deno KV Database Module for Visitor Analytics
// This module handles all KV operations for the Trig Analyse application

// Open KV database connection
const kv = await Deno.openKv();

// 📝 Visitor tracking interface
export interface VisitorLog {
  timestamp: number;
  ip: string;
  userAgent: string | null;
  referer: string | null;
  origin: string | null;
  country: string | null;
  path: string;
  method: string;
}

// 🔍 Enhanced KV operation helpers with error handling
async function safeKvSet(key: Deno.KvKey, value: unknown): Promise<void> {
  try {
    await kv.set(key, value);
  } catch (error) {
    console.error("KV set operation failed:", error);
  }
}

async function safeKvGet<T>(key: Deno.KvKey): Promise<T | null> {
  try {
    const result = await kv.get<T>(key);
    return result.value as T | null;
  } catch (error) {
    console.error("KV get operation failed:", error);
    return null;
  }
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

// 🔍 Log visitor with privacy compliance
export async function logVisitor(req: Request): Promise<void> {
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
  await safeKvSet(["visits", timestamp], visitor);
  
  // 📊 Update counters
  const date = new Date(timestamp);
  
  // Daily: YYYY-MM-DD
  const dateKey = date.toISOString().split("T")[0];
  const dailyCount = await safeKvGet<number>(["daily", dateKey]) || 0;
  await safeKvSet(["daily", dateKey], dailyCount + 1);
  
  // Weekly: YYYY-WW (ISO week number)
  const weekKey = getISOWeek(date);
  const weeklyCount = await safeKvGet<number>(["weekly", weekKey]) || 0;
  await safeKvSet(["weekly", weekKey], weeklyCount + 1);
  
  // Monthly: YYYY-MM
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const monthlyCount = await safeKvGet<number>(["monthly", monthKey]) || 0;
  await safeKvSet(["monthly", monthKey], monthlyCount + 1);
}

// 📈 Get visitor statistics
export async function getStats(limit = 100): Promise<{
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
  const dailyStats: Record<string, number> = {};
  const weeklyStats: Record<string, number> = {};
  const monthlyStats: Record<string, number> = {};
  
  // 📋 Get recent visits (limit to last N visits)
  let entries;
  try {
    entries = kv.list<VisitorLog>({ prefix: ["visits"] }, { 
      limit,
      reverse: true // Most recent first
    });
  } catch (error) {
    console.error("Failed to list visits:", error);
    entries = null;
  }
  
  let totalVisits = 0;
  if (entries) {
    try {
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
    } catch (error) {
      console.error("Error iterating visits:", error);
    }
  }
  
  // 📅 Get daily stats
  try {
    const dailyEntries = kv.list<number>({ prefix: ["daily"] });
    for await (const entry of dailyEntries) {
      const date = entry.key[1] as string;
      dailyStats[date] = entry.value;
    }
  } catch (error) {
    console.error("Failed to list daily stats:", error);
  }
  
  // 📅 Get weekly stats
  try {
    const weeklyEntries = kv.list<number>({ prefix: ["weekly"] });
    for await (const entry of weeklyEntries) {
      const week = entry.key[1] as string;
      weeklyStats[week] = entry.value;
    }
  } catch (error) {
    console.error("Failed to list weekly stats:", error);
  }
  
  // 📅 Get monthly stats
  try {
    const monthlyEntries = kv.list<number>({ prefix: ["monthly"] });
    for await (const entry of monthlyEntries) {
      const month = entry.key[1] as string;
      monthlyStats[month] = entry.value;
    }
  } catch (error) {
    console.error("Failed to list monthly stats:", error);
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
