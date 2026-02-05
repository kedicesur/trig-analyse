/// <reference lib="deno.unstable" />

// 🗑️ Utility script to clear the entire Deno KV database
// Usage: deno run -A clear-db.ts [DATABASE_URL]

const kvUrl = Deno.args[0];
console.log(`Connecting to database at ${kvUrl || "LOCAL"} by ${Deno.env.get("DENO_KV_ACCESS_TOKEN")}`);
const kv = await Deno.openKv(kvUrl);

if (kvUrl) {
  console.log(`🌐 Connected to REMOTE database: ${kvUrl}`);
} else {
  console.log("📁 Connected to LOCAL database.");
}

const proceed = confirm(
  "⚠️ DANGER: This will permanently delete ALL data in the connected database. Proceed?",
);

if (!proceed) {
  console.log("❌ Cancelled.");
  Deno.exit(0);
}

console.log("🧼 Starting cleanup...");

async function clearAll() {
  let totalDeleted = 0;
  const iter = kv.list({ prefix: [] });

  // Use a batch for efficiency
  let atomic = kv.atomic();
  let count = 0;

  for await (const entry of iter) {
    atomic = atomic.delete(entry.key);
    count++;
    totalDeleted++;

    if (count >= 100) {
      await atomic.commit();
      atomic = kv.atomic();
      count = 0;
      console.log(`...deleted ${totalDeleted} keys`);
    }
  }

  await atomic.commit();
  console.log(`✅ Success! Deleted ${totalDeleted} total keys.`);
}

await clearAll();