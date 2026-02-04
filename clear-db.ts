/// <reference lib="deno.unstable" />

// 🗑️ Utility script to clear the entire Deno KV database
// Run with: deno task clear-db

const kv = await Deno.openKv();

// Add a confirmation prompt for safety. This is critical for production environments.
const proceed = confirm(
  "⚠️ DANGER: This will permanently delete ALL data in the connected Deno KV database. Are you sure you want to proceed?",
);

if (!proceed) {
  console.log("❌ Database clearing cancelled.");
  Deno.exit(0);
}

console.log("✅ Confirmation received. Starting database cleanup...");

async function deletePrefix(prefix: Deno.KvKey) {
  console.log(`\n🗑️  Scanning prefix: [${prefix.join(", ")}]...`);
  let count = 0;
  let atomic = kv.atomic();
  const BATCH_SIZE = 100;
  const iter = kv.list({ prefix });

  for await (const entry of iter) {
    atomic.delete(entry.key);
    count++;

    if (count % BATCH_SIZE === 0) {
      const res = await atomic.commit();
      if (!res.ok) console.error("❌ Failed to commit batch!");
      atomic = kv.atomic();
      console.log(`   ...deleted ${count} items so far`);
    }
  }

  const res = await atomic.commit();
  if (!res.ok) console.error("❌ Failed to commit final batch!");
  console.log(`✅ Finished [${prefix.join(", ")}]: Deleted ${count} entries.`);
  return count;
}

// Explicitly delete known prefixes to ensure nothing is missed
let total = 0;
total += await deletePrefix(["visits"]);
total += await deletePrefix(["stats"]);
total += await deletePrefix(["rate_limit"]);

console.log(`\n🎉 Database cleanup complete! Total deleted entries: ${total}`);