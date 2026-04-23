import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} exited with ${code ?? "unknown code"}${signal ? ` (signal ${signal})` : ""}.`,
        ),
      );
    });
  });
}

async function ensureUploadDirectory() {
  const uploadPath = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadPath, { recursive: true });
}

async function main() {
  await ensureUploadDirectory();

  const prismaBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );

  await run(prismaBin, ["migrate", "deploy"], {
    env: process.env,
  });

  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );

  const port = process.env.PORT?.trim() || "3000";
  const host = process.env.HOST?.trim() || "0.0.0.0";

  const child = spawn(nextBin, ["start", "-H", host, "-p", port], {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  child.on("error", (error) => {
    console.error("[cpanel:start] failed to start Next.js:", error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error("[cpanel:start] startup failed:", error);
  process.exit(1);
});
