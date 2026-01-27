/// <reference lib="deno.unstable" />
import { serveDir } from "@std/http/file-server";
import { normalize } from "@std/path";
import { logVisitor, getStats } from "./kv-db.ts";

Deno.serve(async (req, info) => {
  const url = new URL(req.url);
  const rawPath = url.pathname;

  // 📦 API endpoint for version information
  if (rawPath === "/api/version") {
    try {
      const denoJson = JSON.parse(await Deno.readTextFile("./deno.json"));
      return new Response(JSON.stringify({
        name: denoJson.name || "trig-analyse",
        version: denoJson.version || "unknown",
        description: denoJson.description || ""
      }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600" // Cache for 1 hour
        },
      });
    } catch (error) {
      console.error("Failed to read version:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to read version info",
        version: "unknown"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 📊 API endpoint for visitor statistics
  if (rawPath === "/api/stats") {
    try {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const safeLimit = Math.min(Math.max(limit, 1), 500);
      const stats = await getStats(safeLimit);
      
      return new Response(JSON.stringify(stats, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=30"
        },
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to fetch analytics data",
        timestamp: Date.now()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 🔒 Reject suspicious paths early
  const lowered = rawPath.toLowerCase();
  if (
    lowered.includes("..") ||
    lowered.includes("%2e")
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  // 🔒 Normalize path (defensive)
  const safePath = normalize(rawPath);
  if (!safePath.startsWith("/")) {
    return new Response("Forbidden", { status: 403 });
  }

  // ✅ Only log HTML page visits (not assets like JS, CSS, images)
  const shouldLog = 
    rawPath === "/" || 
    rawPath === "/index.html" || 
    rawPath === "/dashboard.html" ||
    rawPath.endsWith(".html");

  // 🚫 Don't log API calls, static assets
  const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(rawPath);
  
  if (shouldLog && !isAsset && !rawPath.startsWith("/api/")) {
    // 📝 Log visitor (async, don't block response)
    logVisitor(req, info).catch(err => {
      console.error("Failed to log visitor:", err);
    });
  }

  // 📦 Serve static files securely
  return serveDir(req, {
    fsRoot: "./public",
    showDirListing: false,
    quiet: true,
  });
});