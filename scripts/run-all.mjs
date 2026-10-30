// Runs the code in every tutorial: install if needed, then tests and typecheck.
// Usage: node scripts/run-all.mjs [tutorial-folder ...]
// Exits 1 if any step fails, so CI and local runs agree.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wanted = process.argv.slice(2);

const folders = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^tutorial-\d+-/.test(d.name))
  .map((d) => d.name)
  .filter((name) => wanted.length === 0 || wanted.includes(name))
  .sort();

if (folders.length === 0) {
  console.error("No tutorial folders found.");
  process.exit(1);
}

function run(cwd, args) {
  const res = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  return res.status === 0;
}

const results = [];

for (const name of folders) {
  const cwd = join(root, name);
  console.log(`\n=== ${name}`);

  const steps = [];
  if (!existsSync(join(cwd, "node_modules"))) {
    const hasLock = existsSync(join(cwd, "package-lock.json"));
    steps.push(["install", [hasLock ? "ci" : "install", "--no-audit", "--no-fund"]]);
  }
  steps.push(["test", ["test"]], ["typecheck", ["run", "typecheck"]]);

  let ok = true;
  for (const [label, args] of steps) {
    console.log(`--- ${label}`);
    if (!run(cwd, args)) {
      ok = false;
      results.push(`FAIL  ${name}  (${label})`);
      break;
    }
  }
  if (ok) results.push(`PASS  ${name}`);
}

console.log("\n=== summary");
for (const line of results) console.log(line);
process.exit(results.some((l) => l.startsWith("FAIL")) ? 1 : 0);
