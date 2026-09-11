/**
 * GOLDEN FRESHNESS — does `csharp/goldens/` still say what the engine says?
 *
 * ⚠ THE GOLDENS ARE A GENERATED ARTIFACT COMMITTED TO THE REPO, which is the whole problem. They are the
 * port's definition of done (`csharp/tools/parity`), but nothing regenerates them automatically and nothing
 * noticed when they went stale. That has now broken the parity gate twice, in two DIFFERENT ways:
 *
 *   1. A change did not regenerate them at all. #1274 edited `data/` — which BOTH engines read — and left
 *      the goldens behind; 78 rows sat red on main until #1281 happened to regenerate them.
 *   2. A MERGE RACE, which is the one no branch-scoped check can see. #1277 changed `beyond`'s ARPABET
 *      without touching goldens (correct on its own) while the #1281 branch regenerated goldens from a tree
 *      that predated it (also correct on its own, and genuinely green there). Git merged both cleanly —
 *      the conflict is SEMANTIC, exactly like a committed lockfile — and main came out red.
 *
 * ⚠ SO THIS MUST RUN ON THE MERGE RESULT, not only on a branch. A branch-only gate passes both branches in
 * case 2 and still lets main break. In this repo that means `npm run ci` on main after a merge, since the
 * GitHub workflow's automatic triggers are deliberately off (see .github/workflows/ci.yml).
 *
 * ⚠ IT DOES NOT REGENERATE, AND THAT IS DELIBERATE. `tools/gen_parity_goldens.mts` needs a 337 MB FLEURS
 * corpus and an alignment DB that are not committed; without them it produces a different, THINNER row set,
 * so a naive regenerate-and-diff would either fail for the wrong reason or overwrite goldens from a degraded
 * source. This re-renders each golden's OWN recorded text and compares the IPA — verifying the rows that are
 * there without needing to re-derive which rows they should be. No corpus required.
 *
 * ⚠ AND THE FIX FOR A FAILURE IS NOT ALWAYS "REGENERATE". A mismatch means the engine and the artifact
 * disagree; which one is wrong is a judgement call. Re-recording a row is what kept `beyond` alive for weeks.
 *
 *   npx tsx tools/check-goldens.mts               every language, one process
 *   npx tsx tools/check-goldens.mts en en-GB      only these
 *   npx tsx tools/check-goldens.mts --isolate     one CHILD PROCESS per language (see below)
 *   npx tsx tools/check-goldens.mts --show 5      print up to N mismatching rows per language
 *   npx tsx tools/check-goldens.mts --no-clear    diagnostic: skip the per-language memo clear
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clearForeignOov } from "../src/core/foreign.ts";
import { phonemizeAsync } from "../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = join(HERE, "..", "csharp", "goldens");

const argv = process.argv.slice(2);
const isolate = argv.includes("--isolate");
/** Diagnostic only: skip the per-language memo clear, to measure whether it is load-bearing. */
const noClear = argv.includes("--no-clear");
const showAt = argv.indexOf("--show");
const show = showAt >= 0 ? Number(argv[showAt + 1] ?? 3) : 0;
const only = new Set(argv.filter((a, i) => !a.startsWith("--") && !(showAt >= 0 && i === showAt + 1)));

const codes = readdirSync(GOLDENS)
    .filter((f) => f.endsWith(".tsv"))
    .map((f) => f.slice(0, -4))
    .filter((c) => only.size === 0 || only.has(c))
    .sort();

interface Result { code: string; rows: number; stale: string[] }

async function checkOne(code: string): Promise<Result> {
    // ⚠ PER LANGUAGE, as tools/gen_parity_goldens.mts does: the foreign-OOV memo is GLOBAL and survives
    // across languages, so without this a row can be a function of what ran before it rather than of its
    // own input — measured at 15 such rows in the Māori golden when the generator lacked this call.
    if (!noClear) clearForeignOov();
    const lines = readFileSync(join(GOLDENS, `${code}.tsv`), "utf8").split("\n").filter((l) => l.includes("\t"));
    const stale: string[] = [];
    for (const line of lines) {
        const tab = line.indexOf("\t");
        const text = line.slice(0, tab), want = line.slice(tab + 1);
        const got = await phonemizeAsync(text, code);
        if (got !== want) stale.push(`    text: ${text.slice(0, 70)}\n    want: ${want}\n    got : ${got}`);
    }
    return { code, rows: lines.length, stale };
}

/** One child process per language — the strongest isolation available, and the only way to prove that a
 *  mismatch is a property of the ROW rather than of everything rendered before it in this process. */
function checkIsolated(code: string): Result {
    // The child exits non-zero when it finds anything, so the verdict is its exit code and the detail is
    // whatever it printed — no output parsing to drift out of step with the printer above.
    try {
        const out = execFileSync("npx", ["tsx", fileURLToPath(import.meta.url), code, "--show", "99"], {
            encoding: "utf8", cwd: join(HERE, ".."), maxBuffer: 64 * 1024 * 1024,
        });
        return { code, rows: Number(/(\d+) rows/.exec(out)?.[1] ?? 0), stale: [] };
    } catch (e) {
        const out = String((e as { stdout?: string }).stdout ?? "");
        return { code, rows: Number(/of (\d+) rows/.exec(out)?.[1] ?? 0), stale: [out.trimEnd()] };
    }
}

const results: Result[] = [];
for (const code of codes) results.push(isolate ? checkIsolated(code) : await checkOne(code));

let staleRows = 0, staleLangs = 0;
for (const r of results) {
    if (r.stale.length === 0) continue;
    staleLangs++; staleRows += r.stale.length;
    console.log(`${r.code}\t${r.rows} rows\t${r.stale.length} stale`);
    for (const s of r.stale.slice(0, show)) console.log(s);
}
const rows = results.reduce((a, r) => a + r.rows, 0);
console.log(
    staleLangs === 0
        ? `goldens fresh: ${codes.length} languages, ${rows} rows, 0 stale`
        : `⚠ STALE: ${staleLangs} of ${codes.length} languages, ${staleRows} of ${rows} rows\n`
          + `  The engine and csharp/goldens/ disagree. Decide WHICH is wrong before regenerating —\n`
          + `  re-recording a row is how a real defect survived weeks of green gates (see #1283).`,
);
process.exit(staleLangs === 0 ? 0 : 1);
