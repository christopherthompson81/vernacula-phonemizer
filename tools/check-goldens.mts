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
 * case 2 and still lets main break. `.github/workflows/ci.yml` runs it on push to main for exactly that.
 *
 * ⚠ IT DOES NOT REGENERATE, AND THAT IS DELIBERATE. `tools/gen_parity_goldens.mts` needs a 337 MB FLEURS
 * corpus and an alignment DB that are not committed; without them it produces a different, THINNER row set,
 * so a naive regenerate-and-diff would either fail for the wrong reason or overwrite goldens from a degraded
 * source. This re-renders each golden's OWN recorded text and compares the IPA — verifying the rows that are
 * there without needing to re-derive which rows should be there. No corpus required.
 *
 * ⚠ AND THE FIX FOR A FAILURE IS NOT ALWAYS "REGENERATE". A mismatch means the engine and the artifact
 * disagree; which one is wrong is a judgement call. Re-recording a row is what kept `beyond` alive for weeks.
 *
 *   npx tsx tools/check-goldens.mts               every language, one process
 *   npx tsx tools/check-goldens.mts en en-GB      only these
 *   npx tsx tools/check-goldens.mts --show 5      print up to N mismatching rows per language
 *   npx tsx tools/check-goldens.mts --isolate     one CHILD PROCESS per language (diagnostic, ~10x slower)
 *   npx tsx tools/check-goldens.mts --no-clear    skip the per-language memo clear (diagnostic)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clearForeignOov } from "../src/core/foreign.ts";
import { phonemize, phonemizeAsync } from "../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const GOLDENS = join(ROOT, "csharp", "goldens");

const argv = process.argv.slice(2);
const isolate = argv.includes("--isolate");
/** Diagnostic: skip the per-language memo clear, to show that the clear is load-bearing. */
const noClear = argv.includes("--no-clear");
/** Internal: emit one JSON object instead of a report, so `--isolate` need not parse prose. */
const asChild = argv.includes("--child");

const showAt = argv.indexOf("--show");
let show = 0;
if (showAt >= 0) {
    const raw = argv[showAt + 1];
    show = Number(raw);
    // ⚠ A NON-NUMERIC OPERAND USED TO FAIL IN THE WORST DIRECTION: `--show en` gave NaN, `slice(0, NaN)`
    // printed nothing, AND `en` was swallowed as the flag's operand — so the run checked all 189 languages
    // and reported no detail, silently, after a minute.
    if (!Number.isInteger(show) || show < 0) {
        console.error(`--show needs a non-negative integer, got ${JSON.stringify(raw)}`);
        process.exit(2);
    }
}
const only = argv.filter((a, i) => !a.startsWith("--") && !(showAt >= 0 && i === showAt + 1));

interface Result { code: string; rows: number; stale: string[] }

const available = new Set(readdirSync(GOLDENS).filter((f) => f.endsWith(".tsv")).map((f) => f.slice(0, -4)));
// ⚠ AN UNKNOWN CODE IS AN ERROR, NOT AN EMPTY RUN. `check-goldens.mts zz` used to print "0 languages,
// 0 rows, 0 stale" and exit 0, so a typo or a not-yet-ported code read as a pass.
const unknown = only.filter((c) => !available.has(c));
if (unknown.length > 0) {
    console.error(`no golden for: ${unknown.join(" ")}`);
    process.exit(2);
}
const codes = [...available].filter((c) => only.length === 0 || only.includes(c)).sort();

/**
 * ⚠ THE NEURAL PATH MUST BE PROVEN LIVE BEFORE ANY COMPARISON, and this guard is the difference between a
 * useful gate and an actively dangerous one. `onnxruntime-node` is an OPTIONAL dependency and both
 * `neuralRegistry.ts` and `core/onnx.ts` catch a load failure and fall back to the sync engine — silently.
 * The goldens are async-mode output, so on a machine where that dependency did not install, every neural
 * language reads as STALE. The instruction this gate prints is "decide which is wrong before regenerating",
 * and the tempting next step — regenerate — would re-record the whole fleet from a degraded engine. That is
 * the exact move #1283 exists to warn against, performed at fleet scale.
 *
 * ⚠ IT ASSERTS AN INEQUALITY, NOT A VALUE. Pinning the IPA of a probe word would make this a second golden
 * that goes stale on its own; what identifies the degraded runtime is that async STOPS DIFFERING from sync.
 */
async function assertNeuralLive(): Promise<void> {
    const probes = ["Muskoka", "Mazumdar"];
    for (const w of probes) if (phonemize(w, "en") !== (await phonemizeAsync(w, "en"))) return;
    console.error(
        "⚠ the neural path is not live — `phonemizeAsync` is falling back to the sync engine.\n"
        + "  The goldens are async-mode output, so every neural language would read as stale and\n"
        + "  regenerating would re-record the fleet from a degraded engine. Check that the optional\n"
        + "  dependency `onnxruntime-node` installed (`npm ls onnxruntime-node`) before trusting this gate.",
    );
    process.exit(2);
}

async function checkOne(code: string): Promise<Result> {
    // ⚠ PER LANGUAGE, as tools/gen_parity_goldens.mts does: the foreign-OOV memo is GLOBAL and survives
    // across languages, so without this a row can be a function of what ran before it rather than of its own
    // input. Measured over the whole fleet: WITHOUT the clear 38 rows go stale in 6 languages (mi, vi, nan,
    // hak, hmn, sat); WITH it, 0 — and that ties one-child-process-per-language at a tenth of the cost.
    if (!noClear) clearForeignOov();
    const lines = readFileSync(join(GOLDENS, `${code}.tsv`), "utf8").split("\n");
    const rows = lines.filter((l) => l.includes("\t"));
    // ⚠ AN EMPTY GOLDEN IS A FAILURE, NOT A PASS. A file truncated by a bad regeneration has no rows to
    // compare, and "0 rows, 0 stale" is indistinguishable from a clean check.
    if (rows.length === 0) return { code, rows: 0, stale: ["    the golden has no data rows at all"] };
    const stale: string[] = [];
    for (const line of rows) {
        const tab = line.indexOf("\t");
        const text = line.slice(0, tab), want = line.slice(tab + 1);
        let got: string;
        // ⚠ A THROW IS A FINDING, NOT A CRASH. An orphan golden (a code dropped or renamed in registry.ts)
        // or a row the engine now rejects used to abort the whole fleet mid-run with a raw stack and leave
        // every later language unchecked — reporting precisely the class of change this gate exists to catch
        // as an infrastructure failure. `gen_parity_goldens.mts` swallows these because a rejected row is
        // not a golden; here the row already IS one, so the rejection is the news.
        try {
            got = await phonemizeAsync(text, code);
        } catch (e) {
            stale.push(`    text: ${text.slice(0, 70)}\n    threw: ${(e as Error).message}`);
            continue;
        }
        if (got !== want) stale.push(`    text: ${text.slice(0, 70)}\n    want: ${want}\n    got : ${got}`);
    }
    return { code, rows: rows.length, stale };
}

/** One child process per language — the strongest isolation available, and the only way to re-prove that a
 *  mismatch is a property of the ROW rather than of everything rendered before it in this process. */
function checkIsolated(code: string): Result {
    // ⚠ THE CHILD SPEAKS JSON. Parsing the human report undercounted every failing language to a single
    // stale row and dropped the per-row detail entirely, so the one mode whose purpose is per-row evidence
    // showed none of it.
    const out = execFileSync("npx", ["tsx", fileURLToPath(import.meta.url), code, "--child"], {
        encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(out) as Result;
}

// ⚠ Not in a child (the parent already proved it) and not under --no-clear, whose whole purpose is to
// produce mismatches.
if (!asChild && !noClear) await assertNeuralLive();

const results: Result[] = [];
for (const code of codes) results.push(isolate ? checkIsolated(code) : await checkOne(code));

if (asChild) {
    console.log(JSON.stringify(results[0]));
    process.exit(0);
}

let staleRows = 0, staleLangs = 0;
for (const r of results) {
    if (r.stale.length === 0) continue;
    staleLangs++; staleRows += r.stale.length;
    console.log(`${r.code}\t${r.rows} rows\t${r.stale.length} stale`);
    for (const s of r.stale.slice(0, show)) console.log(s);
}
const rows = results.reduce((a, r) => a + r.rows, 0);

// ⚠ A GOLDEN THE REGISTRY NO LONGER SERVES, OR A LANGUAGE WITH NO GOLDEN, IS REPORTED RATHER THAN PASSED
// OVER: a newly ported language is otherwise invisible to this gate for as long as nobody generates its
// rows. Harvested from registry.ts's own `case` labels, as the generator does — it has no list to export.
if (only.length === 0) {
    const registry = readFileSync(join(ROOT, "src", "registry.ts"), "utf8");
    const served = new Set([...registry.matchAll(/^\s*case "([^"]+)":/gm)].map((m) => m[1]!));
    const ungolden = [...served].filter((c) => !available.has(c)).sort();
    if (ungolden.length > 0) console.log(`note: ${ungolden.length} registry codes have no golden: ${ungolden.join(" ")}`);
}

console.log(
    staleLangs === 0
        ? `goldens fresh: ${codes.length} languages, ${rows} rows, 0 stale`
        // ⚠ "findings across N rows checked", not "N of M rows": an EMPTY golden contributes a finding and
        // zero rows, and "1 of 0 rows" is the kind of arithmetic a reader stops to puzzle over.
        : `⚠ STALE: ${staleLangs} of ${codes.length} languages, ${staleRows} findings across ${rows} rows checked\n`
          + `  The engine and csharp/goldens/ disagree. Decide WHICH is wrong before regenerating —\n`
          + `  re-recording a row is how a real defect survived weeks of green gates (see #1283).`,
);
process.exit(staleLangs === 0 ? 0 : 1);
