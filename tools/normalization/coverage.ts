/**
 * RETROACTIVE COVERAGE AUDIT — check every ALREADY-TREATED language against the FULL pattern
 * inventory, not the partial one that existed when it was treated.
 *
 * WHY THIS HAS TO EXIST. The 37 treated languages were done one at a time over many batches, and each
 * was judged against whatever was known at that point. The inventory in mine.ts was
 * then derived FROM those 37 — so it is strictly newer than every language in it, and no early language
 * was ever checked against the later cells. That is not hypothetical: `exponent` is declared in 24
 * language manifests and had no cell until the inventory was audited, and the first language checked
 * against it (Burmese) was silently dropping the `²` in `km²` and losing the area entirely.
 *
 * The order the work happened in guarantees the gap. A language treated in batch 1 was measured against
 * roughly a third of the cells that exist now.
 *
 * WHAT IT REPORTS, per language × cell:
 *   ·      the cell does not occur in that language's corpus — nothing to check
 *   ok     it occurs and the engine reads it without a detectable defect
 *   ok*    it occurs, the differential test fires, and every instance is an ACCEPTED SILENT designation —
 *          a product name or bill number whose hyphen is correctly silent (`चंद्रयान -1`, `એચજેઆર -3`).
 *          Listed per instance in `defects.ts` ACCEPTED_SILENT, printed in its own section below, and NOT
 *          counted as a defect. A designation not on that list still reports as a DROP.
 *   DROP   it occurs and a symbol in it VANISHES (differential test: the reading is byte-identical with
 *          the symbol deleted). This is the class the corpus diff was blind to.
 *   LEAK   it occurs and a digit or raw mark SURVIVES into the IPA.
 *
 * A DROP or LEAK is a defect in a language that is already marked done.
 *
 * Usage:  npx tsx tools/normalization/coverage.ts [--langs hu,ro,th] [--max 400]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { ACCEPTED_SIGN_SILENCE, DROPPABLE, LEAK_CLASSES, SIGN_CASES, isAcceptedSilent, isRedundant, makeContribution, withoutSymbol } from "./defects.ts";
import { repairDoubleEncoded } from "../../src/core/unicode.ts";
import { join } from "node:path";
import { CELLS } from "./cells.ts";
import { parseJsonc } from "../../src/core/jsonc.ts";
import { fleursRoot } from "./corpusRoot.ts";

// ⚠ RESOLVED, NOT READ FROM THE ENVIRONMENT — see tools/normalization/corpusRoot.ts. An explicit
// `$FLEURS` still wins; the five FLEURS-only languages have no mined artifact to fall back to, so an
// unset variable there is not a smaller ruler but no ruler at all.
const CORPUS_ROOT = fleursRoot().root;
const TEXT_COLUMN = 2;

/**
 * The FLEURS corpus for a language, where one exists — the FALLBACK evidence source only. `evidence()` prefers
 * the mined artifact, so this map matters just for a language whose artifact is missing.
 *
 * ⚠ THIS IS NOT THE LANGUAGE LIST. It used to be, and it went stale exactly as this file's own header warns:
 * hand-maintained at 37 entries while the tree grew to 67 treated languages, so **30 languages silently were
 * never audited at all** and every "N defective cells across N/37" line understated its own scope. The list is
 * now DERIVED (see TREATED below) and this map is only a lookup.
 */
const FLEURS: [string, string | undefined][] = [
    ["am", "am_et"], ["ar", "ar_eg"], ["bn", "bn_in"], ["cmn", "cmn_hans_cn"], ["de", "de_de"],
    ["el", "el_gr"], ["en", "en_us"], ["es", "es_419"], ["fa", "fa_ir"], ["fr", "fr_fr"],
    ["gu", "gu_in"], ["hi", "hi_in"], ["hu", "hu_hu"], ["id", "id_id"], ["it", "it_it"],
    ["ja", "ja_jp"], ["kn", "kn_in"], ["ko", "ko_kr"], ["ml", "ml_in"], ["mr", "mr_in"],
    ["ne", "ne_np"], ["nl", "nl_nl"], ["or", "or_in"], ["pa", "pa_in"], ["pl", "pl_pl"],
    ["pt", "pt_br"], ["ru", "ru_ru"], ["sr", "sr_rs"], ["sw", "sw_ke"], ["ta", "ta_in"],
    ["te", "te_in"], ["th", "th_th"], ["tr", "tr_tr"], ["uk", "uk_ua"], ["ur", "ur_pk"],
    ["vi", "vi_vn"], ["yue", "yue_hant_hk"],
    // No FLEURS corpus — checked entirely from its mined artifact.
    ["my", undefined],
];
const FLEURS_FOR = new Map(FLEURS);

/**
 * THE TREATED LANGUAGES, DERIVED — the committed mined artifacts ARE the list.
 *
 * This file's header already states the invariant: "Every treated language should have a committed
 * tools/corpus/mined/<lang>.jsonc — that is what makes the second round of the sweep cheap". So the
 * artifact directory is the authoritative register of what has been treated, and reading it removes the one
 * way this audit could under-report: by not knowing about a language.
 *
 * ⚠ WHY THIS MATTERS MORE THAN IT LOOKS. A hardcoded list cannot fail loudly. When it lagged the tree at 37 of
 * 67, the audit still printed a confident "0 defective cells across 0/37" — the number that was wrong was the
 * DENOMINATOR, and nothing in the output hinted that 30 languages had never been looked at. A gate that
 * silently narrows its own scope is worse than one that fails, because its clean runs are believed.
 *
 * Sorted so the matrix and the defect list are stable across runs.
 */
/**
 * THE TREATED LANGUAGES, DERIVED FROM THE TREE — the presence of `src/languages/<dir>/normalize.ts` IS the
 * definition of "treated", so that file is what the list is built from. Nothing to keep in step by hand.
 *
 * The indirection is that this audit needs an ISO CODE (to call `phonemize(text, lang)`) while the tree is laid
 * out by language NAME (`greek/`, `mandarin/`), so the registry supplies the mapping in two hops that are both
 * plain text:
 *     import { createGreek } from "./languages/greek/greek.ts";   →  factory → dir
 *     case "el": return createGreek();                            →  code → factory
 * Registry CASE ORDER decides the canonical code for a dir that serves several, which is what makes `en` win
 * over `en-GB` — the base language is always registered first.
 *
 * ⚠ AN UNRESOLVED DIRECTORY IS REPORTED, NOT SKIPPED. A `normalize.ts` this cannot map to a code is exactly the
 * failure mode that produced the bug below, so it prints a warning instead of quietly shrinking the run.
 */
const LANG_ROOT = new URL("../../src/languages/", import.meta.url).pathname;
const REGISTRY_SRC = readFileSync(new URL("../../src/registry.ts", import.meta.url).pathname, "utf8");

// ⚠ `../corpus/mined/`, NOT `corpus/mined/` — the path `evidence()` carried for the whole sweep, which resolved
// to the non-existent `tools/normalization/corpus/mined/`. The real home is `tools/corpus/`, as review.ts and
// every doc reference agree. So `existsSync` was false for EVERY language and the artifact-first branch never
// once fired: every audit silently ran on FLEURS instead, and the wiki-mined shapes the artifacts exist to
// supply were never checked. Invisible because the fallback was a working code path, so nothing ever threw.
const MINED_DIR = new URL("../corpus/mined/", import.meta.url).pathname;

const dirOfFactory = new Map<string, string>();
for (const m of REGISTRY_SRC.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/languages\/([^/"]+)\//g))
    for (const name of m[1]!.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]!))
        if (name.startsWith("create")) dirOfFactory.set(name, m[2]!);

/**
 * EVERY code the registry routes to each dir — not just the first.
 *
 * ⚠ FALL-THROUGH CASE LABELS ARE THE WHOLE DIFFICULTY, and getting this wrong hid Malay. The registry writes
 *     case "ms":
 *     case "zsm":
 *         return createMalay();
 * so a pattern that expects `return` to follow the label matches only `zsm` — and `zsm` is the code with NO
 * evidence, because the artifact and the FLEURS corpus are both filed under `ms`. registry.ts documents this
 * trap in that very block: "the artifact was filed under a code the registry threw on, and a fleet sweep that
 * iterated the artifacts reported Malay as unreachable". Iterating from the other side reproduces it exactly.
 * So labels are accumulated until a `return` is reached, and all of them are kept.
 */
const codesOfDir = new Map<string, string[]>();
{
    let pending: string[] = [];
    for (const m of REGISTRY_SRC.matchAll(/case\s+"([\w-]+)"\s*:|return\s+(create\w+)/g)) {
        if (m[1] !== undefined) { pending.push(m[1]); continue; }
        const dir = dirOfFactory.get(m[2]!);
        if (dir !== undefined && pending.length) {
            const seen = codesOfDir.get(dir) ?? [];
            for (const c of pending) if (!seen.includes(c)) seen.push(c);
            codesOfDir.set(dir, seen);
        }
        pending = [];
    }
}

/** Does this code have evidence to audit — a mined artifact, or a FLEURS corpus? */
const hasEvidence = (lang: string): boolean =>
    existsSync(join(MINED_DIR, `${lang}.jsonc`)) || FLEURS_FOR.get(lang) !== undefined;

/**
 * The code to audit a dir under: the first one that HAS EVIDENCE, else the first registered.
 *
 * Preferring evidence over registry order is what makes this self-correcting. `ms` and `zsm` are the same
 * engine, and picking by order alone would keep choosing whichever the registry happened to list first with no
 * regard for whether that code can be measured at all.
 */
function codeOfDir(dir: string): string | undefined {
    const codes = codesOfDir.get(dir);
    if (codes === undefined || codes.length === 0) return undefined;
    return codes.find(hasEvidence) ?? codes[0];
}

const treatedDirs = readdirSync(LANG_ROOT)
    .filter((d) => existsSync(join(LANG_ROOT, d, "normalize.ts")))
    .sort();

// ⚠ EVERY EXCLUSION IS ANNOUNCED. A dir that cannot be resolved to a code, or a code with no evidence, used to
// leave the run via a bare `continue` — which is how Malay vanished and how the 37-vs-67 gap stayed invisible
// for the whole sweep. The denominator must never shrink quietly.
const unresolved = treatedDirs.filter((d) => codeOfDir(d) === undefined);
if (unresolved.length)
    console.error(`⚠ ${unresolved.length} dir(s) with a normalize.ts but no registry code: ${unresolved.join(", ")}`);
const noEvidence = treatedDirs
    .flatMap((d) => { const c = codeOfDir(d); return c !== undefined && !hasEvidence(c) ? [`${d} (${c})`] : []; });
if (noEvidence.length)
    console.error(`⚠ ${noEvidence.length} treated language(s) with NO evidence to audit: ${noEvidence.join(", ")}`);

const TREATED: [string, string | undefined][] = treatedDirs
    .flatMap((d) => { const c = codeOfDir(d); return c === undefined ? [] : [c]; })
    .sort()
    .map((lang) => [lang, FLEURS_FOR.get(lang)]);

// The DROP tables come from `defects.ts`, shared with `mine.ts scan` and `corpus-diff.ts emit`. Three copies
// had drifted; this one was the only place that knew `exponent`, `ampersand` and `iteration`, and it was
// blind to `minus` and `math-sign`. It also did NOT do the REDUNDANT discrimination, so a permissible drop —
// a sentence that names its own currency in words — was reported here as a defect.
/** Which cell each drop class reports against. */
const DROP_CELL: Record<string, string> = {
    percent: "percent", currency: "currency", degree: "degrees",
    exponent: "exponent", ampersand: "ampersand", iteration: "iteration",
    minus: "signed-number", "math-sign": "arithmetic",
};

/**
 * ⚠ DERIVED FROM `LEAK_CLASSES`, NOT COPIED FROM IT — and it WAS a copy, which had drifted.
 *
 * The literal that stood here was `\p{Nd}` plus the RAWMARK set: two of the table's classes, missing
 * `SLOT-GAP` and `ZERO-WIDTH` entirely and predating `RAW-CAPS`. That is the exact failure `defects.ts` was
 * extracted to end, one level up — "add a class here, never in a caller", and this caller had its own.
 *
 * ⚠ THE COST OF CLOSING IT WAS MEASURED FIRST, over every `hard` line of all 161 artifacts: `SLOT-GAP` fires
 * on 0 lines, `ZERO-WIDTH` on 0, and `RAW-CAPS` on 68 lines in exactly one language (hmn, whose engine passes
 * unreadable words through verbatim). So this widening reports one real defect and invents nothing — worth
 * stating, because a shared table adopted without measuring is how a gate turns red for the wrong reason.
 */
const LEAK = new RegExp(LEAK_CLASSES.map(([, re]) => re.source).join("|"), "u");

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const only = arg("langs")?.split(",").map((s) => s.trim());
const MAX = Number(arg("max", "400"));

function corpusLines(corpus: string): string[] {
    const dir = join(CORPUS_ROOT, corpus);
    const seen = new Set<string>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
        for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
            const col = line.split("\t")[TEXT_COLUMN];
            // MOJIBAKE IS REPAIRED BEFORE THE SCAN, because otherwise this audit reports symbols THAT ARE NOT
            // THERE. Double-encoded text is full of Latin-1 punctuation used as a UTF-8 continuation byte, and
            // several of those bytes are the very signs the DROP classes look for:
            //   `SÃ£o Paulo`  → `Ã` + `£`  — a POUND SIGN, reported as a currency DROP in a place name
            //   `Ä°zmir`      → `Ä` + `°`  — a DEGREE SIGN, reported as a degree DROP in a population figure
            //   `19.500 kmÂ²` → `Â` + `²`  — the one case where the phantom coincides with a real symbol
            // Both of the first two were chased as per-language defects before the shared cause was spotted, and each
            // would have cost a per-language rule for a sign no reader will ever see.
            //
            // Repairing here is not leniency, it is MATCHING THE ENGINE: the registry applies
            // `repairDoubleEncoded` to every input before any language rule runs, so un-repaired text is input
            // the engine never sees. A gate that measures a different string than the engine reads will report
            // defects that cannot be fixed and miss ones that can — the differential test in particular is
            // unreliable on corrupt input, since blanking a phantom sign can leave a byte-identical reading and
            // so score as a DROP.
            if (col !== undefined && col !== "") seen.add(repairDoubleEncoded(col));
        }
    return [...seen];
}

const { phonemize } = await import(new URL("../../src/index.ts", import.meta.url).href);
const shown = CELLS.filter((c) => !c.lexical);
const rows: { lang: string; status: Record<string, string>; defects: string[]; accepted: string[] }[] = [];

/**
 * A language's evidence, artifact FIRST. Every treated language should have a committed
 * tools/corpus/mined/<lang>.jsonc — that is what makes the second round of the sweep cheap, and it
 * is the only evidence a corpus-less language has at all. FLEURS is the fallback for a language whose
 * artifact has not been generated yet.
 */
function evidence(lang: string, corpus: string | undefined): string[] | undefined {
    const art = new URL(`../corpus/mined/${lang}.jsonc`, import.meta.url).pathname;
    if (existsSync(art)) {
        const doc = parseJsonc(readFileSync(art, "utf8")) as { hard: { text: string }[]; sample?: string[] };
        return [...doc.hard.map((h) => h.text), ...(doc.sample ?? [])];
    }
    if (corpus === undefined) return undefined;
    try { return corpusLines(corpus); } catch { return undefined; }
}

for (const [lang, corpus] of TREATED) {
    if (only && !only.includes(lang)) continue;
    const lines = evidence(lang, corpus);
    if (lines === undefined) continue;
    const status: Record<string, string> = {};
    const defects: string[] = [];
    const accepted: string[] = [];

    for (const cell of shown) {
        const hits = lines.filter((l) => cell.re.test(l));
        if (hits.length === 0) { status[cell.key] = "·"; continue; }
        status[cell.key] = "ok";
        // LEAK: does the reading still carry a digit or a raw mark?
        for (const l of hits.slice(0, MAX)) {
            try {
                if (LEAK.test(phonemize(l, lang) as string)) {
                    status[cell.key] = "LEAK";
                    defects.push(`${cell.key} LEAK: ${l.slice(0, 60)}`);
                    break;
                }
            } catch { /* a throw is its own problem, not this audit's */ }
        }
    }

    // DROP: the differential test, which the leak classes are blind to by construction. A REDUNDANT drop is
    // NOT reported — the sentence already says what the symbol means, so the identical reading is correct.
    const say = (t: string): string | undefined => {
        try { return phonemize(t, lang) as string; } catch { return undefined; }
    };
    const contribution = makeContribution(say);
    // PER CLASS, not per sentence, and that ordering is the whole point: the candidates are the lines that
    // CONTAIN the symbol, and MAX applies to those. Iterating the first MAX lines instead and testing whatever
    // classes they happen to contain looks equivalent and is not — a class whose instances sit late in the
    // corpus is then never tested at all. Measured when I got it wrong: 38 defective cells fell to 15.
    for (const [name, re] of DROPPABLE) {
        const cell = DROP_CELL[name];
        if (cell === undefined) continue;
        const hits = lines.filter((l) => { re.lastIndex = 0; return re.test(l); });
        for (const l of hits.slice(0, MAX)) {
            const ipa = say(l);
            if (ipa === undefined) continue;
            // SUBSTITUTE, never delete — the shared probe. Deleting also changes how the symbol's
            // NEIGHBOURS tokenize, and this loop then credits the symbol for that: Korean's `32℃에` splits
            // into two tokens, and deleting the ℃ agglutinates `32에` into one, so the readings differed and
            // ko scanned CLEAN while `20℃` read as bare *isˈip̚*. Measured over all 66 artifacts, the
            // substitution finds 16 drops this missed and loses none — ten of them the B&B ampersand, in
            // nine languages, which is the defect this gate exists to catch.
            const without = say(withoutSymbol(l, re));
            if (without === undefined || without !== ipa) continue;
            const symbols = [...new Set(l.match(re) ?? [])];
            if (isRedundant(l, ipa, symbols, contribution, say)) continue;
            // ACCEPTED BY IDENTITY — a named designation whose hyphen is correctly silent. Reported in its own
            // section rather than dropped on the floor: an audit that quietly hides five findings teaches you to
            // distrust the clean runs, and the whole value of `0 defective cells` is that it means something.
            // See ACCEPTED_SILENT for why this is a per-instance baseline and not a widened guard.
            if (isAcceptedSilent(lang, name, l, re)) {
                status[cell] = "ok*";
                accepted.push(`${cell}: ${l.slice(0, 60)}`);
                continue;
            }
            status[cell] = "DROP";
            defects.push(`${cell} DROP: ${l.slice(0, 60)}`);
            break;
        }
    }
    rows.push({ lang, status, defects, accepted });
    const bad = Object.values(status).filter((v) => v !== "ok" && v !== "·").length;
    console.error(`${lang} done — ${bad} defective cell(s)`);
}

// Compact matrix: one column per cell, one row per language.
const head = shown.map((c) => c.key.slice(0, 3)).join(" ");
console.log(`\nlang  ${head}`);
for (const r of rows) {
    const cells = shown.map((c) => {
        const v = r.status[c.key] ?? "·";
        return (v === "ok" ? " ok" : v === "·" ? "  ·" : v === "DROP" ? "DRP" : "LEK").padStart(3);
    }).join(" ");
    console.log(`${r.lang.padEnd(5)} ${cells}`);
}

console.log("\n=== defects in languages already marked DONE ===");
let total = 0;
for (const r of rows) {
    if (r.defects.length === 0) continue;
    total += r.defects.length;
    console.log(`\n${r.lang}:`);
    for (const d of r.defects) console.log(`   ${d}`);
}
console.log(`\n${total} defective cells across ${rows.filter((r) => r.defects.length).length}/${rows.length} treated languages`);

// ACCEPTED, PRINTED — never silently withheld. These are the sweep's permanent residual: the differential test
// fires on them and the reading is nonetheless correct, because a designation's hyphen is silent in speech. They
// are shown so a clean defect count stays trustworthy AND so the accepted set stays visible and auditable — a
// baseline nobody can see is indistinguishable from a bug nobody has found.
const acceptedRows = rows.filter((r) => r.accepted.length);
if (acceptedRows.length) {
    console.log("\n=== accepted as correctly silent (designations — see ACCEPTED_SILENT in defects.ts) ===");
    for (const r of acceptedRows) {
        console.log(`\n${r.lang}:`);
        for (const a of r.accepted) console.log(`   ${a}`);
    }
    const n = acceptedRows.reduce((s, r) => s + r.accepted.length, 0);
    console.log(`\n${n} accepted cell(s) across ${acceptedRows.length} language(s) — INTENTIONAL, not a TODO`);
}

/**
 * FLEET-WIDE SIGN-CLASS SWEEP — which signs are still silently DROPPED, and by how many of the treated
 * languages.
 *
 * ⚠ WHY IT BELONGS HERE AND NOT IN A PROBE SCRIPT. `review.ts` runs the same probes for ONE language, so the
 * fleet number had to be re-derived in a scratch file every time it was quoted — and it was quoted against the
 * wrong denominator as a result: counting registered CODES gives 192 and calls ten Arabic dialects ten
 * languages, which overstates both the work and the progress. This file already owns the right denominator, the
 * languages that HAVE a normalization layer, and already prints "N/67" for defective cells.
 *
 * ⚠ AND IT CATCHES A REGRESSION THAT NOTHING ELSE CAN. These signs are ABSENT from the FLEURS corpora — that is
 * the whole reason Wikipedia and register sources are needed — so `corpus-diff.ts` reports 0 changed whether a
 * rule works or has just been deleted. A scripted edit to croatian/normalize.ts REPLACED its `>` rule instead of
 * appending after it, and only the per-language sign check saw it. Sweeping every language every run turns that
 * from a lucky catch into a gate.
 *
 * The probes come from `SIGN_CASES` in defects.ts, shared with `review.ts`, so the two cannot disagree about
 * what a dropped sign is.
 */
console.log("\n=== signs still DROPPED, fleet-wide ===");
const signDrops = new Map<string, string[]>(SIGN_CASES.map(([name]) => [name, []]));
const signAccepted = new Map<string, string[]>(SIGN_CASES.map(([name]) => [name, []]));
let measured = 0;
for (const [lang] of TREATED) {
    const say = (t: string): string | undefined => {
        try { return phonemize(t, lang) as string; } catch { return undefined; }
    };
    measured++;
    const exempt = ACCEPTED_SIGN_SILENCE[lang] ?? {};
    for (const [name, probe, strip] of SIGN_CASES) {
        const full = say(probe), bare = say(probe.replace(strip, ""));
        if (full === undefined || full !== bare) continue;
        // ⚠ AN INTENTIONAL SILENCE IS COUNTED SEPARATELY, NOT SUBTRACTED SILENTLY. A class whose refusal is
        // argued in the language's own file is not an outstanding gap, but hiding it would make the remaining
        // count look like the whole truth — the failure mode this file's own accepted-cells section exists to
        // avoid. So it leaves the `dropped` figure and appears in its own column.
        (exempt[name] !== undefined ? signAccepted : signDrops).get(name)!.push(lang);
    }
}
for (const [name, langs] of signDrops) {
    const n = langs.length, acc = signAccepted.get(name)!;
    const tail = acc.length === 0 ? "" : `   (+${acc.length} intentional: ${acc.join(" ")})`;
    console.log(`  ${name.padEnd(12)} ${String(n).padStart(2)}/${measured} dropped${n === 0 ? "" : `   ${langs.join(" ")}`}${tail}`);
}
// The reasons, printed once, so a zero in the column above is never mistaken for "nothing to know here".
for (const [name, langs] of signAccepted) {
    for (const l of langs) console.log(`  ⓘ ${l} ${name}: ${ACCEPTED_SIGN_SILENCE[l]![name]!}`);
}
