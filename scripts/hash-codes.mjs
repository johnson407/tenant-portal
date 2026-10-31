#!/usr/bin/env node
// Hashes plaintext room access codes with bcrypt and prints env-ready
// ROOM_CODE_HASH_<LETTER> lines. Plaintext codes must never be committed.
//
// Usage:
//   node scripts/hash-codes.mjs --code-into=a          # prompt-free: reads stdin / arg
//   echo 'myCode123' | node scripts/hash-codes.mjs --code-into=b
//   node scripts/hash-codes.mjs --code-into=c 'plaincode01'
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";

const COST = 12;

function parseArgs(argv) {
  const args = { letters: [], codes: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--cost") {
      args.cost = Number(argv[++i]);
    } else if (arg.startsWith("--code-into=")) {
      const letters = String(arg.split("=")[1] || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      args.letters.push(...letters);
    } else {
      args.codes.push(arg);
    }
    i += 1;
  }
  return args;
}

function validateLetters(letters) {
  const valid = new Set(["a", "b", "c", "d", "e"]);
  for (const letter of letters) {
    if (!valid.has(letter)) {
      console.error(`Invalid room letter: ${letter} (expected one of a,b,c,d,e)`);
      process.exitCode = 1;
      return false;
    }
  }
  return true;
}

async function readStdin() {
  if (process.stdin.isTTY) return [];
  const rl = createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) {
    if (line.trim().length > 0) lines.push(line.trim());
  }
  rl.close();
  return lines;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!validateLetters(args.letters) || args.letters.length === 0) {
    console.error("Usage: node scripts/hash-codes.mjs [--cost 12] --code-into=a 'plainCode' (code also via stdin)");
    process.exitCode = process.exitCode || 1;
    return;
  }

  const stdinCodes = await readStdin();
  const codes = [...args.codes, ...stdinCodes];

  for (let idx = 0; idx < args.letters.length; idx += 1) {
    const letter = args.letters[idx].toUpperCase();
    const code = codes[idx];
    // Keep in sync with ROOM_PASSWORD_PATTERN in lib/rooms.ts.
    if (!code || !/^[A-Za-z0-9]{4,64}$/.test(code)) {
      const length = code ? code.length : 0;
      const reason =
        !code || length < 4 || length > 64
          ? `expected 4-64 characters (got ${length})`
          : "only A-Z, a-z, and 0-9 are allowed";
      console.error(`Room ${letter}: ${reason}`);
      process.exitCode = process.exitCode || 1;
      continue;
    }
    const hash = await bcrypt.hash(code, args.cost || COST);
    const verify = await bcrypt.compare(code, hash);
    if (!verify) {
      console.error(`Room ${letter}: generated hash failed self-verification`);
      process.exitCode = 1;
      continue;
    }
    console.log(`ROOM_CODE_HASH_${letter}=${hash}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
