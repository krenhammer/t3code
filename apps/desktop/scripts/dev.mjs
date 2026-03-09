#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(__dirname, "..");
const command = process.env.npm_execpath ? process.execPath : "pnpm";
const baseArgs = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const childSpecs = [
  ["run", "dev:bundle"],
  ["run", "dev:electron"],
];

let shuttingDown = false;
const children = childSpecs.map((args) =>
  spawn(command, [...baseArgs, ...args], {
    cwd: desktopDir,
    stdio: "inherit",
    env: process.env,
  }),
);

function shutdown(exitCode = 0, signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal ?? "SIGTERM");
    }
  }

  process.exit(exitCode);
}

for (const child of children) {
  child.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      shutdown(1, signal);
      return;
    }

    shutdown(code ?? 0);
  });
}

process.once("SIGINT", () => shutdown(130, "SIGINT"));
process.once("SIGTERM", () => shutdown(143, "SIGTERM"));
