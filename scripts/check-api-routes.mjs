import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const serverSource = readFileSync(join(root, "api/_server.ts"), "utf8");
const routePattern = /app\.(get|post|put|delete|patch)\("([^"]+)"/g;

const requiredAdapters = new Map();
let match;

while ((match = routePattern.exec(serverSource))) {
  const [, method, route] = match;
  if (!route.startsWith("/api/")) continue;

  const adapter = route
    .replace(/^\/api\//, "api/")
    .replace(/\/\*$/, "/[...path].ts")
    .replace(/\/:([^/]+)/g, "/[$1]")
    .concat(route.endsWith("/*") ? "" : ".ts");

  requiredAdapters.set(`${method.toUpperCase()} ${route}`, adapter);
}

const missing = [];

for (const [route, adapter] of requiredAdapters) {
  if (!existsSync(join(root, adapter))) {
    missing.push(`${route} -> ${adapter}`);
  }
}

if (missing.length > 0) {
  console.error("Missing Vercel API route adapter files:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`Vercel API route adapters OK (${requiredAdapters.size} routes checked).`);
