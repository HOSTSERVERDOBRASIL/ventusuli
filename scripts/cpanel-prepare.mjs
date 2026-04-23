import { mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  await mkdir(path.join(process.cwd(), "public", "uploads"), { recursive: true });
}

main().catch((error) => {
  console.error("[cpanel:prepare] failed:", error);
  process.exit(1);
});
