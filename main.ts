/// <reference lib="deno.unstable" />
import { serveDir } from "@std/http/file-server";
import { normalize } from "@std/path";
import { logVisitor, getStats } from "./kv-db.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const rawPath = url.pathname;

  // 📊 API endpoint for visitor statistics
  if (rawPath === "/api/stats") {
    try {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      // Ensure reasonable limits for Deno Deploy
      const safeLimit = Math.min(Math.max(limit, 1), 500);
      const stats = await getStats(safeLimit);
      
      return new Response(JSON.stringify(stats, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // Allow dashboard to access
          "Cache-Control": "public, max-age=30" // Cache for 30 seconds
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

  // 📝 Log visitor (async, don't block response) - with enhanced error handling
  logVisitor(req).catch(err => {
    console.error("Failed to log visitor:", err);
    // Don't throw - we don't want to break user experience
  });

  // 📦 3. Serve static files securely
  return serveDir(req, {
    fsRoot: "./public",
    showDirListing: false, // ❌ disable directory listings
    quiet: true,
  });
});
