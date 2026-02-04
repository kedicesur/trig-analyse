/// <reference lib="deno.unstable" />
import { serveDir } from "@std/http/file-server";
import { normalize } from "@std/path";
// Import 'kv' and 'getClientIP' from your DB module
import { checkRateLimit
       , logVisitor
       , getStats
       , getClientIP
       } from "./kv-db.ts";


function serveHandler(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
  const url       = new URL(req.url),
        rawPath   = url.pathname,
        headers   = req.headers,
        clientIP  = getClientIP(headers, info);
  let isAsset,
      shouldLog;

  return rawPath === "/api/version" ? Deno.readTextFile("./deno.json")
                                          .then(text => JSON.parse(text))
                                          .then(denoJson => Response.json({ name: denoJson.name || "trig-analyse"
                                                                          , version: denoJson.version || "unknown"
                                                                          , description: denoJson.description || ""
                                                                          , author: denoJson.author || ""
                                                                          }))
                                          .catch(_ => Response.json({ error: "Failed to read version" }, { status: 500 }))
                                    :
           rawPath === "/api/stats" ? checkRateLimit(clientIP, "stats").then(ok => ok ? getStats(Math.max(1, Math.min( parseInt(url.searchParams.get( "limit")|| "100", 10), 1000)))
                                                                                        .then(stats => Response.json( stats
                                                                                                                    , { headers: { "Access-Control-Allow-Origin": "*"
                                                                                                                                 , "Cache-Control": "public, max-age=10"
                                                                                                                                 }
                                                                                                                      }
                                                                                                                    ))
                                                                                        .catch(e => ( console.error("Stats Error:", e)
                                                                                                    , Response.json( { error: "Internal Server Error"}
                                                                                                                   , { status: 500}
                                                                                                                   )
                                                                                                    ))
                                                                                      : Response.json( { error: "Rate limit exceeded. Try again in 60 seconds."}
                                                                                                     , { status: 429
                                                                                                       , headers: { "Retry-After": "60"}
                                                                                                       }
                                                                                                     ))
                                    :
            rawPath.includes("..") ||
            rawPath.includes("\0")  ? Promise.resolve(new Response("Forbidden", { status: 403 }))
            /* OTHERWISE */         : normalize(rawPath).startsWith("/") ? ( isAsset   = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|map|webp)$/i.test(rawPath)
                                                                           , shouldLog = !isAsset && !rawPath.startsWith("/api/") && (rawPath === "/" || rawPath.endsWith(".html"))
                                                                           , shouldLog && logVisitor(req, clientIP).catch(console.error)
                                                                           , serveDir( req
                                                                                     , { fsRoot: "./public"
                                                                                       , showDirListing: false
                                                                                       , quiet: true
                                                                                       }
                                                                                     )
                                                                           )
                                                                         : Promise.resolve(new Response("Forbidden", { status: 403 }));
}

Deno.serve(serveHandler);