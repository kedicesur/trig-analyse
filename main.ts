import { serveDir } from "@std/http/file-server";
import { normalize } from "@std/path";

Deno.serve(req => {
  const url = new URL(req.url);
  const rawPath = url.pathname;

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

  // 📦 3. Serve static files securely
  return serveDir(req, {
    fsRoot: "./public",
    showDirListing: false, // ❌ disable directory listings
    quiet: true,
  });
});
