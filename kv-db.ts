/// <reference lib="deno.unstable" />
// deno-lint-ignore-file no-cond-assign

// 📊 Deno KV Database Module for Visitor Analytics

// 1. Singleton KV Connection
const kv = await Deno.openKv();

// Helper to safely unwrap Deno.KvU64 to number (handles .sum() stored values)
const unwrap = (v: unknown) => v instanceof Deno.KvU64 ? Number(v.value) : Number(v || 0);

// Helper functions for getStats
const fetchCounters = (prefix: readonly string[]) => Array.fromAsync(kv.list({ prefix }))     // The key is likely ["stats", "paths", "/home"] -> take the last part
                                                          .then(entries => entries.reduce<Record<string, number>>((stats, entry) => ( stats[entry.key[entry.key.length - 1] as string] = unwrap(entry.value) 
                                                                                                                                    , stats
                                                                                                                                    )
                                                                                                                 , {}
                                                                                                                 )),
        sortTop     = (obj: Record<string, number>) => Object.fromEntries(Object.entries(obj) // Sort "Top" lists by value (descending) since KV returns them by Key (alphabetical)
                                                             .sort(([, a], [, b]) => b - a)
                                                             .slice(0, 50));

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

// 📅 Get ISO week number (YYYY-WW format)
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// 🔍 Check if an IP address is private/internal
function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1|fe80:|fc00:|fd00:)/i.test(ip);
}

// 🧹 Periodic cleanup of zombie keys as a helper function for rate limiter
function pruneZombies (endpoint: string, ip: string, currentBucket: number): void {
  Array.fromAsync(kv.list({ prefix: ["rate_limit", endpoint, ip] }))
       .then(entries => entries.length <= 1 ? null 
                                            : entries.reduce( (bat, {key}) => (key[3] as number) !== currentBucket ? bat.delete(key) 
                                                                                                                   : bat
                                                            , kv.atomic()
                                                            )
                                                     .commit())
       .catch(e => console.error("Prune error:", e));
}

/**
 * High-Performance KV Rate Limiter
 * Strategy: Hybrid (Check-then-Act for creation, Blind Increment for updates)
 */
export function checkRateLimit( ip:string
                              , endpoint:string
                              , maxRequests = 20
                              , windowMs = 60000
                              ): Promise<boolean> {
  const key = [ "rate_limit"
              , endpoint
              , ip
              , Math.floor(Date.now()/windowMs) // Time Window Bucket
              ];
  return ip === "unknown" ||
         ip === "local"    ? Promise.resolve(true)         // 1. Fail Open: Don't block localhost or privacy-aware users
                           : kv.atomic()                   // 2. Optimized "First Request" Handling
                               .check({ key                //    We try to set the key with an expiry. This ensures no memory leaks.
                                      , versionstamp:null  //    This atomic transaction ONLY succeeds if the key does NOT exist yet.
                                      })                   //    .check ensures key doesn't exist
                               .set( key                   // Set initial count & TTL
                                   , new Deno.KvU64(1n)
                                   , { expireIn:windowMs }
                                   )
                               .commit()
                               .then(commit => commit.ok ? ( Math.random() < 0.05 && pruneZombies(endpoint, ip, key[3] as number) // Lazy cleanup: 5% chance to prune zombies
                                                           , 1 <= maxRequests // If commit succeeded, we were the first!
                                                           )
                                                         : kv.atomic()       // 3. "Thundering Herd" Handling (Blind Increment)
                                                             .sum(key, 1n)   // Increment. Note: If key expired in the split second between check and sum, this creates a zombie key without TTL.
                                                             .commit()       // We switch to blind increment. No checks, no retries, no contention loops.
                                                             .then(_ => kv.get<Deno.KvU64>(key))                  // 4. Read & Decide
                                                             .then(entry => unwrap(entry.value) <= maxRequests)); // We read the final state to make the decision.
}

// 🌐 Centralized IP Extraction (Used by logging AND rate limiting)
export function getClientIP(headers: Headers, info?: Deno.ServeHandlerInfo): string {
  let ip: string | null = null; 

  return (ip = headers.get("cf-connecting-ip")) ? ip // 1. Cloudflare / Deno Deploy
                                                :
         (ip = headers.get("x-forwarded-for")
                     ?.split(",")[0]
                      .trim() || null)          ? ip // 2. X-Forwarded-For
                                                :
         (ip = headers.get("x-real-ip"))        ? ip // 3. Real IP Header
                                                :
         info?.remoteAddr?.transport === "tcp" ||    // 4. Connection Info
         info?.remoteAddr?.transport === "udp"  ? ( ip = (info.remoteAddr as Deno.NetAddr).hostname.replace(/^::ffff:/, "")
                                                   , isPrivateIP(ip) ? "local"
                                                                     : ip
                                                   )
         /* OTHERWISE */                        : "unknown"; // 5. Fallback
}

// 🌍 Get country from IP address
function getCountryFromIP(ip: string): Promise<string | null> {
  return ip === "unknown" ||
         ip === "local"    ? Promise.resolve(null)
         /* OTHERWISE */   : fetch( `http://ip-api.com/json/${ip}?fields=countryCode`
                                  , {signal: AbortSignal.timeout(2000)}
                                  ).then(res => res.ok ? res.json()
                                                       : null)
                                   .then(data => data?.countryCode || null)
                                   .catch(e => ( console.error("Geo lookup failed:", e)
                                               , null
                                               ));
}

// 📝 Log visitor with Atomic Operations
export function logVisitor(req: Request, ip: string): Promise<void> {
  const headers   = req.headers,
        url       = new URL(req.url),
        timestamp = Date.now(),
        date      = new Date(timestamp),
        referer   = headers.get("referer") || "direct";
  
  return headers.get("dnt") === "1" ||
         headers.get("DNT") === "1" ? Promise.resolve(void 0)   // ✅ Respect Do Not Track
                                    : Promise.resolve(headers.get("cf-ipcountry") || getCountryFromIP(ip))
                                             .then(function(country) {
                                                     const visitor: VisitorLog = { timestamp
                                                                                 , ip
                                                                                 , userAgent: headers.get("user-agent")
                                                                                 , referer
                                                                                 , origin: headers.get("origin")
                                                                                 , country
                                                                                 , path: url.pathname
                                                                                 , method: req.method
                                                                                 };
                                                     return kv.atomic() // ⚡ START ATOMIC TRANSACTION. We use atomic().sum() to ensure counts are accurate even under high load
                                                              .set(["visits", timestamp, crypto.randomUUID()], visitor)      // 1. Store visit with UUID to prevent timestamp collisions
                                                              .sum(["stats", "total"], 1n)                                   // 2. Global Totals (Fixes the "Limit 100" issue)
                                                              .sum(["stats", "paths", url.pathname.slice(0, 128)], 1n)       // Truncate path to prevent key size errors
                                                              .sum(["stats", "countries", country || "unknown"], 1n)
                                                              .sum(["stats", "referers", referer.slice(0, 128)], 1n)         // Truncate referer to prevent key size errors
                                                              .sum(["stats", "daily", date.toISOString().split("T")[0]], 1n) // 3. Time-based Stats (YYYY-MM-DD)
                                                              .sum(["stats", "weekly", getISOWeek(date)], 1n)                //                     (YYYY-WW)
                                                              .sum(["stats", "monthly", `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`], 1n)
                                                              .commit();                                                     // 4. Commit the transaction
                                                  })
                                             .then(commit => !commit.ok ? console.error("Failed to log visitor data")
                                                                        : void 0)
                                             .catch(e => console.error("Error logging visitor:", e));
}

export function getStats(limit = 100) {
         // Parallel fetch for speed
  return Promise.all([ kv.get(["stats", "total"])                       // 1. Fetch Global Counters (Accurate totals)
                     , Array.fromAsync( kv.list( { prefix: [ "visits"]} // 2. Fetch Recent Visits Log (Limited for display)
                                               , { limit
                                                 , reverse: true
                                                 }
                                               )
                                      , e => e.value
                                      )
                     , fetchCounters(["stats", "daily"])                // 3. Helper to fetch all counters for a prefix (Daily, Top Paths, etc.)
                     , fetchCounters(["stats", "weekly"])
                     , fetchCounters(["stats", "monthly"])
                     , fetchCounters(["stats", "paths"])
                     , fetchCounters(["stats", "countries"])
                     , fetchCounters(["stats", "referers"])
                     ])
                .then(([ totalRes
                       , recentVisits
                       , dailyStats
                       , weeklyStats
                       , monthlyStats
                       , topPaths
                       , topCountries
                       , topReferers
                       ]) => ({ totalVisits: unwrap(totalRes?.value)
                              , recentVisits
                              , dailyStats
                              , weeklyStats
                              , monthlyStats
                              , topPaths: sortTop( topPaths)
                              , topCountries: sortTop( topCountries)
                              , topReferers: sortTop( topReferers)
                              }));
}
