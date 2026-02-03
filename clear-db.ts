/// <reference lib="deno.unstable" />

// 🗑️ Utility script to clear the entire Deno KV database
// Run with: deno task clear-db

const kv = await Deno.openKv();

console.log("⚠️  Starting database cleanup...");

let count = 0;
let atomic = kv.atomic();
const BATCH_SIZE = 100;

// List all entries in the database
const iter = kv.list({ prefix: [] });

for await (const entry of iter) {
  atomic.delete(entry.key);
  count++;

  if (count % BATCH_SIZE === 0) {
    await atomic.commit();
    atomic = kv.atomic();
    console.log(`Deleted ${count} entries...`);
  }
}

// Commit any remaining deletions
await atomic.commit();

console.log(`✅ Database cleared! Total deleted entries: ${count}`);