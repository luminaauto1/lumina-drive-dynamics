// run-tests.mjs — bundles the TS smart engine for Node and runs the port
// identity test + (when present) the brain gauntlet.
//   node lumina-chat/engine/run-tests.mjs
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..");
const outDir = path.join(__dirname, ".test-build");
fs.mkdirSync(outDir, { recursive: true });

// bundle entry: re-export everything the tests need from the TS modules
const entry = path.join(outDir, "entry.ts");
fs.writeFileSync(entry, `
export { decide, normKey, dynamicFill, personalize } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "engine.ts").replace(/\\/g, "/")}";
export { buildContext } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "context.ts").replace(/\\/g, "/")}";
export { buildSmartKb, decideSmart } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "brain.ts").replace(/\\/g, "/")}";
export { normalizeText, baseLexicon, buildVocab, segments } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "normalize.ts").replace(/\\/g, "/")}";
export { composeAnswers, openedWithGreeting } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "composer.ts").replace(/\\/g, "/")}";
export { matchSegment as __matchSegment, matchAll } from "${path.join(repo, "supabase", "functions", "_shared", "chat", "matcher.ts").replace(/\\/g, "/")}";
`);

execSync(
  `npx esbuild "${entry}" --bundle --format=esm --platform=node --outfile="${path.join(outDir, "chat-bundle.mjs")}"`,
  { cwd: repo, stdio: "inherit" },
);

// 1) port identity
execSync(`node "${path.join(__dirname, "test-port.mjs")}"`, { cwd: repo, stdio: "inherit" });

// 2) brain gauntlet (only when the utterance seed exists)
const gauntlet = path.join(__dirname, "test-brain.mjs");
if (fs.existsSync(gauntlet)) {
  execSync(`node "${gauntlet}"`, { cwd: repo, stdio: "inherit" });
}
