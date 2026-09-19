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
 * case 2 and still lets main break. That cannot be a CI job (see the machine-locality note below), so it is
 * `npm run ci` on `main` after a merge — a ritual, not a mechanism, which is the honest state of it.
 *
 * ⚠ IT DOES NOT REGENERATE, AND THAT IS DELIBERATE. `tools/gen_parity_goldens.mts` needs a 337 MB FLEURS
 * corpus and an alignment DB that are not committed; without them it produces a different, THINNER row set,
 * so a naive regenerate-and-diff would either fail for the wrong reason or overwrite goldens from a degraded
 * source. This re-renders each golden's OWN recorded text and compares the IPA — verifying the rows that are
 * there without needing to re-derive which rows should be there. No corpus required.
 *
 * ⚠ RUN THIS ON THE MACHINE THAT GENERATED THE GOLDENS — that is the CONTRACT, not a caveat (#1287). For
 * the 74 languages that depend on ONNX (derive them with `--no-ort`), the output is NOT bit-reproducible
 * across CPU microarchitectures: int8 inference dispatches to different kernels, and a rounding difference
 * occasionally flips an argmax. Measured between an Intel Comet Lake and an AMD EPYC runner: 44 rows of
 * 36,495 (0.12%), e.g. `Bellingshausen` losing one phone — `bˈɛlɪŋzʃˌaᶷzən` against `bˈɛlɪŋʃˌaᶷzən`.
 * That is why this check is NOT in the CI workflow: it cannot pass on hardware other than the generator's,
 * and a gate that is red by construction is noise. ⚠ DO NOT "FIX" THAT by making the comparison tolerant or
 * by exempting the neural languages — both were weighed and rejected (see csharp/PORTING.md); the same
 * applies to any future attempt to run this somewhere else.
 * ⚠ A COUNT CANNOT SEPARATE THAT NOISE FROM REAL STALENESS, which is why there is no tolerance mode: the
 * `beyond` regression (#1283) was 3 rows and the cross-machine noise is 44, so any threshold that admits
 * the second hides the first.
 *
 * ⚠ AND THE FIX FOR A FAILURE IS NOT ALWAYS "REGENERATE". A mismatch means the engine and the artifact
 * disagree; which one is wrong is a judgement call. Re-recording a row is what kept `beyond` alive for weeks.
 *
 *   npx tsx tools/check-goldens.mts               every language, one process
 *   npx tsx tools/check-goldens.mts en en-GB      only these
 *   npx tsx tools/check-goldens.mts --jobs 8      N worker processes, one ORT thread each (~2x faster)
 *   npx tsx tools/check-goldens.mts --show 5      print up to N mismatching rows per language
 *   npx tsx tools/check-goldens.mts --isolate     one CHILD PROCESS per language (diagnostic, ~10x slower)
 *   npx tsx tools/check-goldens.mts --no-clear    skip the per-language memo clear (diagnostic)
 *   npx tsx tools/check-goldens.mts --no-ort      derive which languages depend on ONNX (diagnostic)
 *   npx tsx tools/check-goldens.mts --write       rewrite the IPA of the rows that are there, once you
 *                                                 have DECIDED the engine is right (see `write` below)
 *
 * ⚠ `--jobs` IS A SCHEDULING CHANGE, AND EVERY WORD OF THE MACHINE-LOCALITY CONTRACT ABOVE STILL HOLDS —
 * it makes the same comparison on the same rows, in a different order across more heaps. What it may NOT
 * be read as is a second opinion: pool size changes float reduction order the same way a different
 * microarchitecture does, so ⚠ IF A `--jobs` RUN AND A SERIAL RUN EVER DISAGREE, THE SERIAL RUN IS THE ONE
 * THAT DEFINES THE GOLDENS, and the disagreement itself is the finding. It was measured not to move the
 * output on the generating machine (189 languages, 36,495 rows, identical verdict at 1, 2, 4 and 16
 * threads), which is a measurement on one CPU, not a guarantee for another — hence the refusal to write
 * from it, below.
 *
 * ⚠ AND A NAIVE SHARD WAS ALREADY BUILT ONCE AND THROWN AWAY. Partitioning the languages at the DEFAULT
 * ORT settings bought 12% of the wall for double the CPU, with one setting slower than serial, because
 * ORT's intra-op pool is already one thread per core and N children × that fight over the same cores
 * (docs/investigations/en/test_wall_time_investigation.md, Run 5). The cap is the whole mechanism: with
 * the pool pinned to one thread per child the same partition runs 47.5 s → 23.8 s on 8 physical cores.
 * The floor past that is arithmetic, not scheduling — 93 CPU-seconds of work and one language (`pnb`) that
 * is 10.6 s of it on its own (docs/investigations/check_goldens_runtime_investigation.md).
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { availableParallelism } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { clearForeignOov } from "../src/core/foreign.ts";
import { setOrtLoader, setOrtSessionDefaults } from "../src/core/onnx.ts";
import { phonemize, phonemizeAsync } from "../src/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const GOLDENS = join(ROOT, "csharp", "goldens");

const argv = process.argv.slice(2);
const isolate = argv.includes("--isolate");
/** Diagnostic: skip the per-language memo clear, to show that the clear is load-bearing. */
const noClear = argv.includes("--no-clear");
/**
 * Internal: serve JSON instead of a report, so the parent modes need not parse prose — a code per line on
 * stdin, a Result per line on stdout. See `serveChild`.
 */
const asChild = argv.includes("--child");
/**
 * Internal: cap THIS heap's ORT intra-op pool to one thread. Set on every `--jobs` child and nowhere else.
 *
 * ⚠ IT BELONGS TO THE CHILD, NOT TO THE ENGINE. The per-core default is the right setting for a single
 * serial run and for production inference, where one request wants every core it can get; it is only wrong
 * when the CALLER is already running N of them, which is exactly and only the `--jobs` children.
 */
const capOrt = argv.includes("--cap-ort");
/**
 * Diagnostic: force every neural path to fall back, so a language whose output MOVES is ONNX-dependent —
 * directly, or through a foreign span it delegates to an engine that is.
 *
 * ⚠ THIS EXISTS BECAUSE THE HAND-WRITTEN ANSWER IS BADLY WRONG — and the first draft of this very comment
 * proved it by getting the count wrong. TWELVE language directories own an ONNX model (afrikaans, arabic,
 * bengali, central-kurdish, danish, english, french, hebrew, khmer, norwegian, persian, sindhi) plus
 * `data/core/riderDiacritizer.onnx`; the derived set is SEVENTY-FOUR of 189, by at least three routes:
 *   · the shared Arabic diacritizer, which serves nine codes beyond `ar` through `ARABIC_VARIETY`
 *     (acm acw afb ajp apc apd ary arz ayl) without any of them owning a model;
 *   · the core rider diacritizer, reached by Punjabi;
 *   · and delegation — a non-Latin engine that meets an embedded Latin run hands it to the English neural
 *     reader, which is why `ru`, `ja`, `th`, `cmn`, `ko`, `el` appear at one to ten rows each.
 * Any list of "the neural languages" maintained by hand is a silent hole.
 */
const noOrt = argv.includes("--no-ort");
/**
 * Rewrite each golden's IPA column from what the engine says NOW, leaving the row set untouched.
 *
 * ⚠ THIS IS NOT `gen_parity_goldens.mts`, and the difference is the whole reason it can live here. That
 * tool re-derives WHICH ROWS exist, from a 337 MB FLEURS corpus and an alignment DB that are not committed
 * — without them it produces a thinner row set, which is why the header says this file does not regenerate.
 * This writes back the IPA of the rows ALREADY IN THE FILE, against each row's own recorded text, so no
 * corpus is involved and no row is added, dropped or reordered.
 *
 * ⚠ IT WRITES THE VALUE THE CHECK COMPUTED, not a second rendering. A `--write` that re-rendered on its own
 * could disagree with the gate it is meant to satisfy, which is the one thing a regeneration must never do.
 *
 * ⚠ AND IT IS STILL THE DANGEROUS OPERATION THIS FILE WARNS ABOUT. Re-recording a row is how the `beyond`
 * regression survived weeks of green gates (#1283). The guards below are what make it safe to offer at all:
 * the neural-liveness assertion still runs, and the degraded and child modes refuse it outright. What they
 * cannot check is whether the operator actually decided the ENGINE was right — that is on the reader, and
 * the run prints what it changed so the decision has evidence attached.
 */
const write = argv.includes("--write");

/** Argv positions eaten by a flag's operand, so they are not read back as language codes. */
const operands = new Set<number>();

// ⚠ A NON-NUMERIC OPERAND FAILS IN THE WORST DIRECTION, so every numeric flag is parsed here: `--show en`
// gave NaN, `slice(0, NaN)` printed nothing, AND `en` was swallowed as the flag's operand — so the run
// checked all 189 languages and reported no detail, silently, after a minute.
function intFlag(name: string, fallback: number, min: number): number {
    const at = argv.indexOf(name);
    if (at < 0) return fallback;
    operands.add(at + 1);
    const raw = argv[at + 1];
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min) {
        console.error(`${name} needs an integer >= ${min}, got ${JSON.stringify(raw)}`);
        process.exit(2);
    }
    return value;
}

const show = intFlag("--show", 0, 0);
/**
 * `--jobs N`: N worker processes, each with a one-thread ORT pool. 1 is the shipped serial behaviour.
 *
 * ⚠ CLAMPED TO THE CORE COUNT, as `tools/referee-eval/eval.ts` already clamps its own: each worker is a
 * whole child process that loads the engine and its models, so an unbounded `--jobs` is a fork bomb with a
 * model in each one — `--jobs 189` would be one process per language. Nothing above the core count is
 * faster anyway: measured 22.8 s at 6 workers, 23.9 s at 8, 26.7 s at 12 on 8 physical cores.
 */
const jobs = Math.min(intFlag("--jobs", 1, 1), availableParallelism());
const only = argv.filter((a, i) => !a.startsWith("--") && !operands.has(i));

interface Result { code: string; rows: number; stale: string[]; rewritten?: string }

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
    // ⚠ WALKED BY INDEX OVER THE WHOLE FILE, not over `rows`, for two reasons that both bite. A golden may
    // carry blank or comment lines, which `rows` filters out and a rebuild would silently delete. And rows
    // REPEAT — `en.tsv` carries the same text twice — so keying a rewrite by line CONTENT writes both
    // copies to the first one's index and leaves the second stale, which reads afterwards as a regeneration
    // that did not converge.
    const out = write ? [...lines] : [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.includes("\t")) continue;
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
        if (write) out[i] = `${text}\t${got}`;
    }
    return { code, rows: rows.length, stale, rewritten: write ? out.join("\n") : undefined };
}

/** One child process per language — the strongest isolation available, and the only way to re-prove that a
 *  mismatch is a property of the ROW rather than of everything rendered before it in this process. */
function checkIsolated(code: string): Result {
    // ⚠ THE CHILD SPEAKS JSON. Parsing the human report undercounted every failing language to a single
    // stale row and dropped the per-row detail entirely, so the one mode whose purpose is per-row evidence
    // showed none of it.
    // ⚠ THE DIAGNOSTIC FLAGS MUST BE FORWARDED. `setOrtLoader` and the memo clear act on THIS heap only, so
    // a child spawned without them runs a fully-enabled engine — and `--isolate --no-ort` then reports
    // "0 stale", i.e. "nothing depends on ONNX", which is exactly the silently-wrong answer `--no-ort`
    // exists to prevent. It did that, quietly and green, until review caught it.
    const out = execFileSync(RUNNER, childArgv(), {
        encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024, input: `${code}\n`,
    });
    return JSON.parse(out) as Result;
}

/**
 * ⚠ A WORKER IS ONE PROCESS, AND THAT IS A CORRECTNESS REQUIREMENT BEFORE IT IS A SPEED ONE. `npx tsx`
 * interposes a shell AND the tsx launcher re-execs node, so the engine ran two levels down — `child.kill()`
 * reaped a wrapper and left the process doing the work alive. On the failure path below the parent would
 * then exit 2 while N−1 workers kept rendering, stopping only whenever their stdin happened to EOF, which
 * for `pnb` is another ten seconds. Measured: `npx tsx` gave `sh -c` → `tsx` → `node`, and
 * `node --import tsx` gives one process, the one we hold. It also drops two process spawns per worker from
 * a change whose whole point is wall time.
 */
const RUNNER = process.execPath;

/**
 * Exit once stdout has actually drained.
 *
 * ⚠ `process.exit` DOES NOT FLUSH A PIPE, and every output this tool produces goes down one — to the
 * `--jobs` parent, or to a test harness capturing it. A bare `process.exit(0)` after ~640 `console.log`
 * calls can therefore truncate the report mid-line, and the truncation is SILENT: the reader sees a
 * short but well-formed transcript with no error in it. Worse in a child, where a lost last line is a
 * lost LANGUAGE, and worse again on the error paths, where the `console.error` explaining the failure
 * is the thing that goes missing.
 * ⚠ THIS IS A SUSPECT, NOT A PROVEN CAUSE. `test/check-goldens-jobs.test.ts` fails intermittently with
 * exactly that signature — a 349-line pooled report against a 643-line serial one, no error line — and
 * three separate diagnoses of it (contention, maxBuffer, a dead worker) were all wrong. This removes
 * the cheapest mechanism that produces the symptom; if the flake survives, it was something else.
 */
async function exitFlushed(code: number): Promise<never> {
    for (const s of [process.stdout, process.stderr]) {
        if (s.writableLength > 0) await new Promise<void>((r) => s.write("", () => r()));
    }
    process.exit(code);
}

/** The argv every child is spawned with, so the two spawning modes cannot drift apart. */
function childArgv(extra: string[] = []): string[] {
    return ["--import", "tsx", fileURLToPath(import.meta.url), "--child", ...extra, ...childFlags()];
}

/**
 * ⚠ THE DIAGNOSTIC FLAGS MUST BE FORWARDED TO EVERY CHILD. `setOrtLoader` and the memo clear act on the
 * heap that called them, so a child spawned without them runs a fully-enabled engine — and
 * `--isolate --no-ort` then reports "0 stale", i.e. "nothing depends on ONNX", which is exactly the
 * silently-wrong answer `--no-ort` exists to prevent. It did that, quietly and green, until review caught
 * it. Shared by both child-spawning modes so neither can drift from the other.
 */
function childFlags(): string[] {
    return [...(noOrt ? ["--no-ort"] : []), ...(noClear ? ["--no-clear"] : [])];
}

/**
 * `--jobs N`: N long-lived children, each handed the next unstarted language as it reports the last one.
 *
 * ⚠ THE PARTITION IS LEGITIMATE FOR THE SAME REASON `--isolate` IS. The only state that crosses languages
 * is the foreign-OOV memo, and `checkOne` already clears it per language — measured: without the clear 38
 * rows go stale in 6 languages, with it 0, in-process and one-child-per-language alike. If the ORDER
 * within a heap does not matter, neither does WHICH heap.
 *
 * ⚠ WORK-STEALING, NOT A STATIC SPLIT, BECAUSE THE COSTS ARE NOT REMOTELY EVEN. `pnb` is 10.6 s and `nan`
 * 7.9 s of a 93 CPU-second fleet; the median language is under 0.1 s. Any fixed partition either needs a
 * committed cost table — a second generated artifact going stale inside the very tool that exists to
 * complain about the first — or leaves seven cores idle behind one language. Handing out the next code on
 * completion needs neither.
 *
 * ⚠ LARGEST GOLDEN FIRST, which is the one scheduling decision left. The tail of the run is a single
 * language long, so a big one picked up last is dead wall time; file size is a free, always-current proxy
 * for "probably slow" and needs nothing committed. It is only a heuristic — `nan`'s cost is its Latin
 * delegation, not its byte count — but it is strictly better than directory order.
 */
async function checkPooled(order: string[], n: number): Promise<Result[]> {
    // ⚠ SIZED ONCE, NOT INSIDE THE COMPARATOR. `statSync` per comparison is ~1,500 syscalls for 189 codes
    // instead of 189, and a throw from inside a comparator surfaces as a sort error rather than as the
    // missing golden it actually is.
    const size = new Map(order.map((c) => [c, statSync(join(GOLDENS, `${c}.tsv`)).size]));
    const queue = [...order].sort((a, b) => size.get(b)! - size.get(a)!);
    const children: ChildProcess[] = [];
    const results: Result[] = [];
    let next = 0;
    const worker = (): Promise<void> => new Promise<void>((resolve, reject) => {
        const child = spawn(RUNNER, childArgv(["--cap-ort"]), { cwd: ROOT, stdio: ["pipe", "pipe", "inherit"] });
        children.push(child);
        const feed = (): void => {
            if (next < queue.length) child.stdin!.write(`${queue[next++]}\n`);
            else child.stdin!.end();
        };
        createInterface({ input: child.stdout!, crlfDelay: Infinity }).on("line", (line) => {
            results.push(JSON.parse(line) as Result);
            feed();
        });
        child.on("error", reject);
        // ⚠ A CHILD THAT DIES IS A FAILED RUN, NOT A SHORTER ONE. Its share of the queue is simply never
        // dealt out, so swallowing the exit code would print "goldens fresh" over languages nobody checked
        // — a green gate that verified less than it claimed, which is this file's oldest failure mode.
        // ⚠ AND IT IS `close`, NOT `exit`: `exit` fires when the PROCESS ends, which says nothing about
        // whether the parent has drained the pipe it left behind. `close` fires once the stdio streams are
        // done, so every line the worker wrote has reached the reader above before this resolves.
        child.on("close", (status) => {
            if (status === 0) resolve();
            else reject(new Error(`a worker exited with status ${status} — see its output above`));
        });
        feed();
    });
    try {
        await Promise.all(Array.from({ length: Math.min(n, queue.length) }, worker));
    } catch (e) {
        for (const c of children) c.kill();
        console.error(`--jobs: ${(e as Error).message}`);
        await exitFlushed(2);
    }
    // ⚠ EVERY LANGUAGE MUST COME BACK, AND THE REPORT CANNOT NOTICE ON ITS OWN. The verdict line counts
    // `codes.length`, so a worker that dropped a language would print the full "189 languages" over a
    // smaller row total — a green gate that verified less than it claimed, which is the failure this file
    // exists to refuse. The hand-off is depth-1 and a worker only exits after its last line was read, so
    // this should be unreachable; it is here because "should be unreachable" is what the two bugs in the
    // sibling `--jobs` mode also were (test/referee-eval-shard.test.ts).
    if (results.length !== order.length) {
        console.error(`--jobs: ${results.length} of ${order.length} languages came back — the run is incomplete`);
        await exitFlushed(2);
    }
    // Completion order is a race; the report is not allowed to be. Sorted the way `codes` is, by code
    // unit, so a pooled report is line-for-line comparable with a serial one.
    return results.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/**
 * The child's whole protocol: a language code per line in, one `Result` as JSON per line out, EOF to stop.
 *
 * ⚠ IT IS A STREAM RATHER THAN ONE CODE ON ARGV BECAUSE `--jobs` NEEDS THE CHILD TO OUTLIVE THE LANGUAGE.
 * A child per language pays the module graph and the model loads 189 times — that is what makes `--isolate`
 * ~10× slower than serial, and it would eat the entire win here. One protocol serves both modes:
 * `--isolate` writes a single line and closes the pipe.
 */
async function serveChild(): Promise<void> {
    for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
        const code = line.trim();
        if (code === "") continue;
        process.stdout.write(`${JSON.stringify(await checkOne(code))}\n`);
    }
}

// ⚠ THE DEGRADED AND CHILD MODES MAY NOT WRITE. `--no-ort` manufactures mismatches on purpose and skips
// the liveness guard, so writing under it would re-record the fleet from an engine with its neural path
// switched off — the exact fleet-scale version of #1283 this file exists to prevent.
if (write && (noOrt || noClear || isolate || asChild || capOrt || jobs > 1)) {
    console.error("--write cannot be combined with --no-ort, --no-clear, --isolate, --child,\n"
        + "  --cap-ort or --jobs:\n"
        + "  those modes run a degraded, delegated or differently-configured engine, and writing\n"
        + "  from one re-records the goldens from something that is not the engine.");
    await exitFlushed(2);
}

// ⚠ THE TWO PARALLEL MODES ARE NOT COMPOSABLE AND MUST NOT SILENTLY PICK ONE. `--isolate` exists to prove
// that a mismatch belongs to its row by giving the row a virgin heap; `--jobs` packs many languages into
// each heap for speed. Accepting both would advertise the first guarantee while delivering the second.
if (jobs > 1 && isolate) {
    console.error("--jobs and --isolate are opposite answers to the same question; pick one:\n"
        + "  --isolate proves a mismatch belongs to its row, --jobs shares a heap between languages.");
    await exitFlushed(2);
}

// ⚠ `--jobs --no-clear` PRODUCES A SILENTLY WEAKER ANSWER, WHICH IS WHY IT IS REFUSED RATHER THAN
// DOCUMENTED. `--no-clear` exists to demonstrate that the per-language memo clear is load-bearing, and it
// does so by letting each language inherit whatever the PREVIOUS one left in the foreign-OOV memo —
// a result that is a property of the sequence. Split that sequence across N heaps and most languages no
// longer follow the language that poisoned them: measured on the six known-sensitive codes, serial
// `--no-clear` moves `hmn`, and `--jobs 4 --no-clear` moves nothing and prints "nothing here depends on
// what this flag disables". That is the strongest possible wrong answer to the only question the flag
// asks. (`--no-ort` has no such interaction — it degrades each row on its own terms, and serial and
// pooled runs agree row for row — so it is forwarded, not refused.)
if (jobs > 1 && noClear) {
    console.error("--jobs cannot be combined with --no-clear:\n"
        + "  --no-clear asks what each language inherits from the one before it, and --jobs\n"
        + "  gives each worker a different 'one before it'. Run --no-clear serially.");
    await exitFlushed(2);
}

if (noOrt) setOrtLoader(() => Promise.reject(new Error("ORT disabled by --no-ort")));
// ⚠ BEFORE ANY MODEL LOADS. Every neural path memoises its own session, so a cap installed after the first
// inference would be accepted and ignored — and the run would look capped while running at full width.
if (capOrt) setOrtSessionDefaults({ intraOpNumThreads: 1, interOpNumThreads: 1, executionMode: "sequential" });

// Not under a flag whose whole purpose is to produce mismatches, and not in a plain `--isolate` child —
// there the parent has already proved it in an identically-configured heap.
// ⚠ BUT A CAPPED CHILD RE-PROVES IT, because the parent's proof does NOT cover the capped configuration.
// If the thread cap ever broke session creation, `loadOrt` would reject, every neural path would fall back
// silently, and the fleet would read as stale — the failure this guard exists to refuse, arriving by a new
// route. It costs one model load per worker, in parallel, which is the cheapest insurance in this file.
// ⚠ AND THE `--jobs` PARENT SKIPS IT: it renders nothing itself, and each worker proving its own heap is
// strictly stronger than the parent proving a heap no row will be rendered in.
if (!noClear && !noOrt && (capOrt || (!asChild && jobs === 1))) await assertNeuralLive();

if (asChild) {
    await serveChild();
    await exitFlushed(0);
}

async function runAll(): Promise<Result[]> {
    if (jobs > 1) return checkPooled(codes, jobs);
    const out: Result[] = [];
    for (const code of codes) out.push(isolate ? checkIsolated(code) : await checkOne(code));
    return out;
}
const results = await runAll();

// ⚠ WRITTEN ONLY WHERE THE CONTENT ACTUALLY MOVED, so a regeneration touches the files it has a reason to
// and `git status` after it is the list of languages that changed — evidence, rather than 189 files with
// identical contents and new mtimes.
if (write) {
    let changed = 0;
    for (const r of results) {
        if (r.rewritten === undefined) continue;
        const path = join(GOLDENS, `${r.code}.tsv`);
        if (r.rewritten === readFileSync(path, "utf8")) continue;
        writeFileSync(path, r.rewritten);
        changed++;
        console.log(`rewrote ${r.code}.tsv (${r.stale.length} rows)`);
    }
    console.log(changed === 0
        ? "nothing to write — every golden already matches the engine"
        : `wrote ${changed} golden${changed === 1 ? "" : "s"}. Re-run without --write to confirm.`);
    await exitFlushed(0);
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

// ⚠ A DIAGNOSTIC RUN MUST NOT PRINT THE REGENERATE PROMPT. Its mismatches are synthetic by construction —
// `--no-ort` degrades the engine on purpose and skips the liveness guard — and the single largest hazard
// this file documents is someone regenerating goldens from a degraded engine. Printing "decide which is
// wrong before regenerating" at the end of a run that manufactured the mismatches invites precisely that,
// to a reader who arrives at the tail of a 189-language log minutes later.
if (noOrt || noClear) {
    const flag = noOrt ? "--no-ort" : "--no-clear";
    console.log(
        staleLangs === 0
            ? `${flag}: no language moved — nothing here depends on what this flag disables`
            : `${flag}: ${staleLangs} of ${codes.length} languages moved, ${staleRows} rows.\n`
              + `  These are NOT stale goldens — this run disabled part of the engine on purpose.\n`
              + `  ${noOrt ? "A language listed above is ONNX-dependent, directly or by delegation." : ""}`,
    );
    await exitFlushed(0);
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
