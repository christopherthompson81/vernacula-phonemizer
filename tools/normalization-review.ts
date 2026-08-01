/**
 * NORMALIZATION REVIEW (#562) — the mechanical half of reviewing a language's normalization layer.
 *
 * WHY THIS EXISTS. Reviewing the Czech layer (#588) turned up four defects, and ALL FOUR were checklist
 * items rather than insights: no tests, three silently dropped sign classes, a numeral that did not agree
 * with its noun, and an uncommitted artifact. Every one is machine-checkable, and checking them by hand
 * cost about nine minutes of repeated `vitest` runs and one-probe-per-process startup — against five
 * minutes of actual judgement.
 *
 * So: run this BEFORE opening a PR, and again when reviewing one. What it cannot do is decide whether a
 * reading is *right for the language* — that stays human, and it is the part worth spending time on.
 *
 * ⚠ IT IS NECESSARY, NEVER SUFFICIENT. The Czech artifact scanned "no defects" while an ampersand in its
 * own hard-set was being dropped: removing `&` changed the tokenization (`BB` is one initialism, `B B` is
 * two letters), so the differential test concluded the symbol contributed. A symbol can change the output
 * without ever being spoken. That is why the sign probes below PRINT their readings instead of only
 * asserting a difference — read them.
 *
 * Usage:  npx tsx tools/normalization-review.ts --lang cs [--dir czech]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
};
const lang = arg("lang");
if (lang === undefined) {
    console.error("usage: --lang <code> [--dir <languages-subdir>]");
    process.exit(2);
}

/** Resolve the language directory from the registry: `case "cs":` … `createCzech()` … and the import that
 *  names the file. Passed explicitly with --dir when a language's wiring does not follow that shape. */
function resolveDir(code: string): string | undefined {
    const reg = readFileSync("src/registry.ts", "utf8");
    const imports = new Map<string, string>();
    for (const m of reg.matchAll(/import \{\s*(create\w+)[^}]*\} from "\.\/languages\/([^/]+)\//gu))
        imports.set(m[1]!, m[2]!);
    const at = reg.indexOf(`case "${code}":`);
    if (at === -1) return undefined;
    const block = reg.slice(at, at + 600);
    for (const m of block.matchAll(/(create\w+)\s*\(/gu)) {
        const dir = imports.get(m[1]!);
        if (dir !== undefined) return dir;
    }
    return undefined;
}

const dir = arg("dir") ?? resolveDir(lang);
if (dir === undefined) {
    console.error(`could not resolve the languages/ subdir for "${lang}" — pass --dir`);
    process.exit(2);
}

const results: [string, boolean | null, string][] = [];
const note = (name: string, ok: boolean | null, detail: string): void => { results.push([name, ok, detail]); };

// ── 1. the normalizer exists and is wired ──────────────────────────────────────────────────────────
const normPath = join("src/languages", dir, "normalize.ts");
const hasNorm = existsSync(normPath);
note("normalizer", hasNorm, hasNorm ? normPath : `${normPath} missing`);
if (!hasNorm) { report(); process.exit(1); }

// ALL exported normalizers, not the first: czech/normalize.ts exports both `normalizeCzech` and
// `normalizeCzechInitialisms`, and matching only the first reported "no tests" for a file that has them.
const exportNames = [...readFileSync(normPath, "utf8").matchAll(/export function (normalize\w+)/gu)].map((m) => m[1]!);
const exportName = exportNames[0];
// The engine is not necessarily the first non-normalize .ts file alphabetically: uzbek/ sorts numbers.ts
// before uzbek.ts, turkish/ sorts g2p.ts before turkish.ts. Scan EVERY candidate engine file, so a
// normalizer wired into any of them is found.
const engineFiles = readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".ts") && !f.includes("normalize") && !f.includes(".test."));
const engineSrc = engineFiles.map((f) => readFileSync(join("src/languages", dir, f), "utf8")).join("\n");
const engine = engineFiles.find((f) => readFileSync(join("src/languages", dir, f), "utf8").includes(exportName)) ?? engineFiles[0];
const called = exportNames.filter((n) => engineSrc.includes(n));
note("wired into text()", called.length > 0, called.length > 0 ? `${engine} calls ${called.join(", ")}` : `no call to ${exportNames.join("/")} found`);

// ── 2. tests reference the normalizer (Czech shipped none; the suite was identical before and after) ──
const testFiles = [
    ...readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => join("test", f)),
    ...readdirSync(join("src/languages", dir)).filter((f) => f.endsWith(".test.ts")).map((f) => join("src/languages", dir, f)),
];
const testing = testFiles.filter((f) => { const src = readFileSync(f, "utf8"); return exportNames.some((n) => src.includes(n)); });
note("tests", testing.length > 0, testing.length > 0 ? testing.join(", ") : `no test file references ${exportNames.join("/")}`);

// ── 3. the artifact is committed (Czech's was left untracked) ─────────────────────────────────────
const artifact = join("tools/corpus/mined", `${lang}.jsonc`);
let tracked = false;
try { execSync(`git ls-files --error-unmatch ${artifact}`, { stdio: "ignore" }); tracked = true; } catch { /* untracked */ }
note("artifact tracked", tracked, tracked ? artifact : `${artifact} ${existsSync(artifact) ? "exists but is UNTRACKED" : "missing"}`);

// ── 4. the probes. PRINTED, not merely asserted — see the header. ─────────────────────────────────
const { phonemize } = await import(new URL("../src/index.ts", import.meta.url).href);
const say = (t: string): string => { try { return (phonemize(t, lang) as string).trim(); } catch (e) { return `THROW ${(e as Error).message.slice(0, 40)}`; } };

/** A symbol that contributes NOTHING is a hard fail; one that merely changes the output is printed for a
 *  human to judge, because changing tokenization is not the same as being spoken. */
const signCases: [string, string, RegExp][] = [
    ["minus", "-5", /[-−]/gu],
    ["plus", "+5", /\+/gu],
    ["ampersand", "A&B", /&/gu],
    ["equals", "x = y", /=/gu],
    ["less-than", "5 < 6", /</gu],
    ["times", "6 × 6", /×/gu],
    ["percent", "25 %", /%/gu],
    ["degrees", "20 °C", /°/gu],
];
const dropped: string[] = [];
console.log(`\n── sign classes (read these; a DROPPED line is a hard fail) ──`);
for (const [name, probe, strip] of signCases) {
    const full = say(probe), bare = say(probe.replace(strip, ""));
    const isDropped = full === bare;
    if (isDropped) dropped.push(name);
    console.log(`  ${name.padEnd(11)} ${probe.padEnd(8)} ${isDropped ? "DROPPED" : "       "}  ${full.slice(0, 46)}`);
}
note("sign classes", dropped.length === 0, dropped.length === 0 ? "none dropped" : `DROPPED: ${dropped.join(" ")}`);

console.log(`\n── numeral agreement (does the numeral suit its noun? judgement required) ──`);
for (const probe of ["1:15", "2:00", "21:00", "1 km", "2 km", "5 km", "21 %"])
    console.log(`  ${probe.padEnd(8)} ${say(probe).slice(0, 52)}`);

console.log(`\n── ordinary text and a sentence end must survive ──`);
for (const probe of ["1990-1995", "12,5", "1.234", "5 000"])
    console.log(`  ${probe.padEnd(10)} ${say(probe).slice(0, 52)}`);

// ── 5. the artifact scan ──────────────────────────────────────────────────────────────────────────
if (tracked || existsSync(artifact)) {
    try {
        const out = execSync(`npx tsx tools/normalization-mine.ts scan --in ${artifact} --lang ${lang}`, { encoding: "utf8" });
        const clean = out.includes("no defects");
        note("artifact scan", clean, clean ? "no defects" : out.trim().split("\n").slice(-3).join(" | "));
    } catch { note("artifact scan", null, "scan failed to run"); }
} else note("artifact scan", null, "no artifact");

function report(): void {
    console.log(`\n── checklist ──`);
    let failed = 0;
    for (const [name, ok, detail] of results) {
        const mark = ok === null ? " ?? " : ok ? " ok " : "FAIL";
        if (ok === false) failed++;
        console.log(`  [${mark}] ${name.padEnd(18)} ${detail}`);
    }
    console.log(`\n${failed === 0 ? "checklist clean" : `${failed} FAILING`} — the readings above still need a human.`);
    console.log("Not covered here: referee before/after, and reading every change in the sample tier.\n");
}
report();
process.exit(results.some(([, ok]) => ok === false) ? 1 : 0);
