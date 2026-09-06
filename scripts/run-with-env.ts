import { spawn } from "node:child_process";
import { config } from "dotenv";

const envFile = process.argv[2];
const command = process.argv[3];
const args = process.argv.slice(4);
if (!envFile || !command) {
  console.error("Usage: tsx scripts/run-with-env.ts <env-file> <command> [...args]");
  process.exit(1);
}

config({ path: envFile, override: true });
const child = spawn(command, args, { stdio: "inherit", env: process.env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
