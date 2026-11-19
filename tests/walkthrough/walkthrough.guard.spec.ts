import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Enforces the human-only rule by code, not by prose (template section 1/7.3):
 * journey step files under tests/walkthrough/steps/ may not use any forbidden
 * pattern. observers/ is the one allowlisted place that legitimately needs
 * request/response/console hooks — those never act, only watch.
 *
 * Tamper-tested below: a planted violation must make this same check fail,
 * proving the grep itself actually works and isn't silently matching nothing.
 */
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STEPS_DIR = path.join(REPO_ROOT, "tests/walkthrough/steps");

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\brequest\b/,
  /\bfetch\s*\(/,
  /\bprisma\b/,
  /\bpg\b/,
  /\.skip\b/,
  /\.fixme\b/,
  /\bisVisible\s*\(/,
  /\btry\s*\{/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bcookies\b/,
];

type Violation = { file: string; line: number; pattern: string; text: string };

/**
 * Blanks out comments and string/template literal contents (keeping their
 * quotes and line count intact) so a forbidden identifier is only ever
 * caught when it's actually code — not when it's a word inside app UI text
 * a step legitimately asserts against (e.g. "Invalid request body") or a
 * comment explaining why. Deliberately simple (no real tokenizer): good
 * enough for the patterns below, which all target identifiers/call syntax
 * that would never need to survive this blanking to be real violations.
 * Known gap, accepted: a `${...}` interpolation inside a template literal
 * is blanked along with the rest of the literal, so a forbidden call
 * smuggled inside one would be missed. This is a tripwire against
 * accidental misuse, not a hardened boundary against a step author
 * actively trying to evade it.
 */
function blankNonCode(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === "//") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      out += quote + source.slice(i + 1, j - 1).replace(/[^\n]/g, " ") + (j <= n ? source.slice(j - 1, j) : "");
      i = j;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function scanDirForViolations(dir: string): Violation[] {
  const violations: Violation[] = [];
  if (!fs.existsSync(dir)) return violations;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...scanDirForViolations(full));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;

    const raw = fs.readFileSync(full, "utf8");
    const codeOnly = blankNonCode(raw);
    const rawLines = raw.split("\n");
    const codeLines = codeOnly.split("\n");
    codeLines.forEach((text, idx) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
          violations.push({ file: full, line: idx + 1, pattern: pattern.source, text: rawLines[idx]?.trim() ?? "" });
        }
      }
    });
  }
  return violations;
}

test("no journey step uses a forbidden actor pattern", () => {
  const violations = scanDirForViolations(STEPS_DIR);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test("tamper test: a planted violation is actually caught", () => {
  const tmpDir = path.join(STEPS_DIR, "__guard_tamper_test__");
  const tmpFile = path.join(tmpDir, "planted.ts");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    tmpFile,
    "export async function plantedViolation() {\n" +
      "  try {\n" +
      "    await fetch('https://example.test');\n" +
      "  } catch {}\n" +
      "}\n",
  );

  try {
    const violations = scanDirForViolations(STEPS_DIR);
    const caught = violations.filter((v) => v.file === tmpFile);
    // try {, fetch(, and the bare catch block's lack of a forbidden token
    // aside — at minimum `try {` and `fetch(` must both be caught.
    expect(caught.map((v) => v.pattern)).toEqual(
      expect.arrayContaining([/\btry\s*\{/.source, /\bfetch\s*\(/.source]),
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("steps/ directory exists and is where the guard looks", () => {
  expect(fs.existsSync(STEPS_DIR)).toBe(true);
});
