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

// 🔧 Enhanced KV operation helpers with error handling
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

// 🔍 Check if an IP address is private/internal
function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1|fe80:)/i.test(ip);
}

// 🌐 Extract real IP address from Deno Deploy headers
function getRealIP(headers: Headers): string {
  // On Deno Deploy, the real client IP is in x-forwarded-for
  // Format: "client-ip, proxy1, proxy2"
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (the actual client)
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    if (ips[0]) return ips[0];
  }

  // Fallback to other headers
  const cfConnecting = headers.get("cf-connecting-ip");
  if (cfConnecting) return cfConnecting;

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

// 🌍 Get country from IP address using ip-api.com (free, no key required)
// Rate limit: 45 requests per minute
async function getCountryFromIP(ip: string): Promise<string | null> {
  // Skip for unknown/private IPs
  if (ip === "unknown" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }

  try {
    // Using ip-api.com free tier (no API key needed)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.countryCode || null;
    }
  } catch (error) {
    // Silently fail - don't block visitor logging if geo lookup fails
    console.error("Failed to get country for IP:", ip, error);
  }
  
  return null;
}

// 📝 Log visitor with privacy compliance
export async function logVisitor(req: Request, info: Deno.ServeHandlerInfo): Promise<void> {
  const headers = req.headers;
  
  // ✅ Respect Do Not Track header
  const dnt = headers.get("dnt") || headers.get("DNT");
  if (dnt === "1") {
    return; // Don't track if user has DNT enabled
  }

  const url = new URL(req.url);
  const timestamp = Date.now();
  
  // 🛡️ Enhanced IP detection with connection info fallback
  let ip = getRealIP(headers);
  
  // Fallback: If headers gave "unknown" but we have connection info, use that
  if (ip === "unknown" && info) {
    // Check if remoteAddr is a NetAddr (has hostname property)
    if (info.remoteAddr.transport === "tcp" || info.remoteAddr.transport === "udp") {
      const remoteIP = info.remoteAddr.hostname;
      // Only use the connection IP if it's not a private/internal IP
      ip = isPrivateIP(remoteIP) ? "local" 
                                 : remoteIP.startsWith("::ffff:") ? remoteIP.substring(7)
                                                                  : remoteIP;
    }
  }
  
  // 🌍 Get country from IP (async, but we'll await it)
  const country = headers.get("cf-ipcountry") || await getCountryFromIP(ip);
  
  const visitor: VisitorLog = { timestamp
                              , ip
                              , userAgent:headers.get( "user-agent")
                              , referer:headers.get( "referer")
                              , origin:headers.get( "origin")
                              , country
                              , path:url.pathname
                              , method:req.method
                              , 
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

  return { totalVisits
         , recentVisits
         , dailyStats
         , weeklyStats
         , monthlyStats
         , topReferers: refererCount
         , topCountries: countryCount
         , topPaths: pathCount
         };
}