// Read-only inventory of pages and API routes in the ims repo.
// Usage: node inventory.mjs <repoRoot> > inventory.json
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.argv[2];
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const appFiles = walk(path.join(root, "app"));
const pages = appFiles
  .filter((f) => /\/page(\.core|\.pro)?\.tsx$/.test(f) && !f.includes("/api/"))
  .map((f) => path.relative(root, f));
const routes = appFiles.filter((f) => /\/route(\.core|\.pro)?\.ts$/.test(f)).map((f) => path.relative(root, f));

const toUrl = (rel, kind) =>
  "/" +
  rel
    .replace(/^app\//, "")
    .replace(kind === "page" ? /\/?page(\.core|\.pro)?\.tsx$/ : /\/?route(\.core|\.pro)?\.ts$/, "")
    .replace(/\/$/, "");

const clientDirs = ["lib", "hooks", "components", "contexts", "stores", "utils"].map((d) => path.join(root, d));
const appNonApi = appFiles.filter((f) => !f.includes("/app/api/") && /\.(ts|tsx)$/.test(f));

const grepFiles = (needle) => {
  const hits = new Set();
  for (const d of clientDirs) {
    try {
      const out = execFileSync("grep", ["-rIl", "--include=*.ts", "--include=*.tsx", "-F", needle, d], { encoding: "utf8" });
      out.split("\n").filter(Boolean).forEach((x) => hits.add(path.relative(root, x)));
    } catch {}
  }
  for (const f of appNonApi) {
    if (fs.readFileSync(f, "utf8").includes(needle)) hits.add(path.relative(root, f));
  }
  return [...hits];
};

const api = routes
  .filter((r) => !/\.(core|pro)\.ts$/.test(r))
  .map((r) => {
    const src = fs.readFileSync(path.join(root, r), "utf8");
    const methods = [...src.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    const url = toUrl(r, "route");
    // static prefix before first dynamic segment is what client code references
    const prefix = url.split("/[")[0];
    const refs = grepFiles(prefix).filter((f) => !f.endsWith(".test.ts"));
    const guards = {
      session: /getSession|getServerSession|withAuth|getCurrentUser|requireAuth/.test(src),
      roleCheck: /role\s*(===|!==)|isAdminRole|can\(/.test(src),
      csrf: /validateCSRF/.test(src),
      zod: /safeParse|\.parse\(/.test(src),
      webhookSig: /signature|verifyQStash|constructEvent|Receiver/i.test(src),
    };
    return { file: r, url, methods, clientRefs: refs.length, clientRefSample: refs.slice(0, 3), guards };
  });

const pg = pages
  .filter((p) => !/\.(core|pro)\.tsx$/.test(p))
  .map((p) => ({ file: p, url: toUrl(p, "page") || "/" }));

console.log(JSON.stringify({ pages: pg, api }, null, 1));
