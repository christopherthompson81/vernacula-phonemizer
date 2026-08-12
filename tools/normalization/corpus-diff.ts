/**
 * CORPUS BEFORE/AFTER DIFF for a normalization change — the verification gate that caught more real
 * defects than any other check while the first thirteen languages were done by hand.
 *
 * Usage, in two steps, because "before" and "after" are two different CHECKOUTS of the code:
 *
 *   # 1. baseline, from a pristine worktree pinned at the commit you started from
 *   npx tsx tools/normalization/corpus-diff.ts emit --lang ja --corpus ja_jp --out /tmp/ja.before
 *   # 2. your tree, then compare
 *   npx tsx tools/normalization/corpus-diff.ts emit --lang ja --corpus ja_jp --out /tmp/ja.after
 *   npx tsx tools/normalization/corpus-diff.ts compare --before /tmp/ja.before --after /tmp/ja.after \
 *       --corpus ja_jp
 *
 * WHY TWO STEPS AND NOT `git stash`. The hand recipe stashed the working tree to produce the baseline.
 * That is fine for one person working alone and actively dangerous the moment two agents share a checkout:
 * `git stash` is global, so one agent's baseline run silently pockets every other agent's uncommitted work.
 * Emitting to a file from a read-only worktree has the same effect with no shared mutable state — see
 * the fan-out procedure, which sets the worktree up once for the whole batch.
 *
 * THE DEFECT CLASSES are the ones the thirteen languages kept producing. A rule that looks right on a
 * handful of probes still lands these at corpus scale:
 *   DIGIT     an ASCII digit survived into the IPA — the number path declined and leaked its input
 *   SLOT-GAP  a double/leading/trailing space, almost always a padded `clausePunctuation` value
 *   RAWMARK   a punctuation or symbol character reached the phoneme string
 *   THROW     the engine raised on an input it used to accept
 * `--foreign` additionally counts utterances carrying phonemes outside the language's own inventory, which
 * is what the embedded-Latin fallback produces (see core/foreign.ts); pass it a regex of foreign phonemes.
 *
 * HOW THE TWO SIDES ARE PAIRED. `emit` writes the readings and, alongside them, the source text one line
 * per reading; `compare` pairs a before-reading with an after-reading BY THAT SOURCE TEXT, and falls back
 * to position when there is no usable `.src`. A row that exists on one side only is reported and left out
 * of the comparison rather than paired against its neighbour. See `readRecords` and `pairRows` for why —
 * the short version is that an utterance the engine reads as the EMPTY STRING is a record like any other,
 * this file used to filter it out, and that made `compare` throw on exactly the improvement it exists to
 * measure.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dropsIn, makeContribution } from "./defects.ts";
import { repairDoubleEncoded } from "../../src/core/unicode.ts";
import { parseJsonc } from "../../src/core/jsonc.ts";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CORPUS_ROOT = process.env["FLEURS"] ?? "";
/** FLEURS transcript column 3 is the ORIGINAL cased text; column 4 is lowercased and stripped of the
 *  punctuation this layer exists to read. Normalization must always be judged on column 3. */
const TEXT_COLUMN = 2; // 0-indexed

const args = process.argv.slice(2);
const mode = args[0];
const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
};

/** Every utterance of a corpus, deduplicated — FLEURS repeats a sentence once per speaker, and counting a
 *  defect three times because three people read it overstates the defect. */
/**
 * THE TEXT UNDER TEST, from either evidence source.
 *
 * ⚠ THIS GATE COULD NOT READ THE CORPORA IT EXISTS TO CHECK, which made it deliverable
 * unusable for its own stated purpose. The observation was that "the normalization work is gated on a
 * per-language corpus diff, which is the check that has found more real defects than any other. That confines
 * the plan to the ~66 languages with a FLEURS corpus" — and then supplies mined artifacts for 87 more. But this
 * file read `CORPUS_ROOT` and nothing else, so `--corpus km_kh` simply threw: the corpora arrived and the gate
 * that consumes them was never taught to look.
 *
 * The `mined:` prefix mirrors `mine.ts`'s own `fleurs:` convention, and is EXPLICIT rather than a fallback on
 * purpose. An implicit "try the artifact if the corpus is missing" is how `coverage.ts` spent an entire sweep
 * silently reading FLEURS while believing it read artifacts — a wrong relative path made `existsSync` false for
 * every language, and because the fallback was a working code path nothing ever threw.
 *
 * ⚠ AND AN ARTIFACT IS NOT A CORPUS, so the two are not interchangeable for every question. `hard` is selected
 * adversarially, so a count inside it says nothing about the language; `sample` is a uniform stride, which is
 * the real distribution only for a dump-sourced artifact. For the BEFORE/AFTER question this file asks — did my
 * change alter how any of this text reads — that does not matter: both sides read the same lines, and a
 * difference is a difference. It matters enormously for any claim about frequency, which this file never makes.
 */
function minedLines(lang: string): string[] {
    const art = new URL(`../corpus/mined/${lang}.jsonc`, import.meta.url).pathname;
    const doc = parseJsonc(readFileSync(art, "utf8")) as { hard: { text: string }[]; sample?: string[] };
    // Deduplicated and repaired identically to the FLEURS path, so the two sources are measured by one ruler.
    const seen = new Set<string>();
    for (const t of [...doc.hard.map((h) => h.text), ...(doc.sample ?? [])]) if (t !== "") seen.add(repairDoubleEncoded(t));
    return [...seen];
}

/** `mined:<lang>` reads the committed artifact; anything else is a FLEURS directory name. */
function textLines(source: string): string[] {
    return source.startsWith("mined:") ? minedLines(source.slice(6)) : corpusLines(source);
}

function corpusLines(corpus: string): string[] {
    const dir = join(CORPUS_ROOT, corpus);
    const seen = new Set<string>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
        for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
            const col = line.split("\t")[TEXT_COLUMN];
            // MOJIBAKE REPAIRED BEFORE THE DIFF, for the reason coverage.ts spells out at its own ingestion:
            // double-encoded text uses Latin-1 punctuation as continuation bytes, and some of those bytes ARE
            // the symbols the DROP classes hunt — `SÃ£o Paulo` contains a `£` and `Ä°zmir` a `°`. Un-repaired,
            // this gate reports a permanent un-closable DROP on a place name.
            // The engine already applies this pass to every input, so repairing here makes the gate measure the
            // string the engine actually reads. Note this is the RULER, not the engine: the same ingestion must
            // be used for both sides of a before/after, and only the engine should differ between them.
            if (col !== undefined && col !== "") seen.add(repairDoubleEncoded(col));
        }
    return [...seen];
}

const DEFECTS: [string, RegExp][] = [
    // `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so this class was blind to
    // a digit leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯,
    // Khmer, Lao. RAWMARK below happened to list the Devanagari, Arabic-Indic and Persian ranges, which
    // made the gap look smaller than it was: those three scripts were covered by accident and the rest
    // were not covered at all. Found while mining a Burmese hard-set.
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance in the corpus and the check tells you nothing. What belongs
    // here is a mark that should have been converted to one of those and wasn't: a native terminator, a
    // symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because the Italian run found the class silently missing them: it had
    // `°` (U+00B0) only, so the ordinal-indicator leak `dell'11º` → `undˈit͡ʃi º` passed the scan clean and
    // was caught by probing instead. The three characters look alike and are routinely confused; a scan
    // that knows one and not the others gives false assurance.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³$€£¥०-९٠-٩۰-۹।॥۔؟،؛]/u],
    // A SYMBOL THAT VANISHED. Every class above detects a character that SURVIVES into the IPA; none of
    // them can see one that is silently DISCARDED, and that blind spot is why a currency drop
    // went unnoticed through thirty-seven languages of corpus-driven work. `emit` appends this marker
    // after phonemizing the utterance a second time with the symbol deleted and finding the two readings
    // identical — proof the symbol contributed nothing.
    ["DROP", /\u27EADROP:/u],
];

// The defect tables and the REDUNDANT discrimination live in `defects.ts`, shared with `mine.ts scan`
// and `coverage.ts`. They were three copies and they had DRIFTED — this file's `minus` class was missing
// the EN DASH, and it had no `math-sign`, `exponent`, `ampersand` or `iteration` class at all, so the
// gate could not see a dropped `&` or `²`. See that file's header for the full table.

/**
 * AN ARTIFACT IS A POSITIONAL RECORD, AND THE EMPTY STRING IS A READING.
 *
 * ⚠ This function exists because `compare` used to parse both artifacts with
 * `.split("\n").filter((l) => l !== "")`, and that filter deletes records. Line *i* of an artifact is the
 * reading of line *i* of its `.src`; when the engine reads an utterance as the empty string — every letter
 * deleted because the script fell outside its TOKEN class — the record is an empty LINE, not an absent one.
 * Dropping it shortens one side of the diff.
 *
 * The failure mode is precisely backwards. An engine that STARTS reading something it used to drop is the
 * improvement this whole layer of work exists to produce, and it was the one change that made the
 * instrument refuse to measure: `ug` went from two empty readings to none (the Arabic presentation-form
 * segments, commit 9c7ae09) and `compare` answered `length mismatch — different corpora?` on two artifacts
 * emitted from the same corpus, byte-identical `.src` files and all. The `ug` run worked around it by
 * padding both sides with a sentinel, which is a change to the RULER in the middle of a measurement.
 *
 * And the throw was the LUCKY case. Had one utterance gone empty→text while another went text→empty, the
 * counts would have matched, the filter would have slid the two arrays past each other, and `compare`
 * would have printed fabricated differences with no error at all. A wrong pairing is worse than a crash.
 *
 * So: split, and drop only the ONE trailing empty element produced by the terminating newline `emit`
 * writes. Everything else is a record.
 */
export function readRecords(raw: string): string[] {
    const lines = raw.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines;
}

/** How a `compare` paired its two sides, and what it could not pair. */
export interface Pairing {
    /** `[beforeIndex, afterIndex]`, in `after` order. */
    pairs: [number, number][];
    /** `after` indices whose source text is in no `before` artifact — new corpus rows. */
    addedOnly: number[];
    /** `before` indices whose source text is in no `after` artifact — corpus rows that went away. */
    removedOnly: number[];
    by: "identity" | "position";
    /** Why identity pairing was declined, when it was. */
    note?: string;
}

/**
 * PAIR BY WHAT PRODUCED THE ROW, NOT BY WHERE IT LANDED.
 *
 * `emit` already writes the source text alongside the readings, and both corpus readers accumulate into a
 * `Set` — so a source line is UNIQUE within an artifact by construction, which makes it a usable row
 * identity and not merely a label for the examples. Pairing on it means the two sides stay aligned even
 * when the corpus itself gained or lost a line between the two checkouts, and a row that exists on one
 * side only is REPORTED rather than silently paired against its neighbour.
 *
 * Positional pairing is kept as the fallback and is not merely legacy: an artifact emitted before `.src`
 * existed, or one whose `.src` has fallen out of step, still compares — position is the only identity such
 * a pair has, and it is correct whenever both sides read the same corpus in the same order, which is the
 * ordinary case. What is NOT kept is guessing: if the `.src` cannot be trusted the reason is printed.
 */
export function pairRows(B: string[], A: string[], SB: string[] | undefined, SA: string[] | undefined): Pairing {
    const positional = (note?: string): Pairing => ({
        pairs: A.map((_, i) => [i, i] as [number, number]).filter(([i]) => i < B.length),
        addedOnly: A.map((_, i) => i).filter((i) => i >= B.length),
        removedOnly: B.map((_, i) => i).filter((i) => i >= A.length),
        by: "position",
        ...(note === undefined ? {} : { note }),
    });
    if (SB === undefined || SA === undefined) return positional("no .src alongside one of the artifacts");
    if (SB.length !== B.length || SA.length !== A.length)
        return positional(`.src is out of step with its artifact (before ${SB.length}/${B.length}, after ${SA.length}/${A.length})`);
    const where = new Map<string, number>();
    for (const [i, s] of SB.entries()) {
        // A duplicated source line means the identity is not one, which only happens if the corpus reader
        // stopped deduplicating. Decline rather than pick an arm at random.
        if (where.has(s)) return positional("the before .src repeats a source line, so it is not an identity");
        where.set(s, i);
    }
    const pairs: [number, number][] = [], addedOnly: number[] = [], taken = new Set<number>();
    for (const [i, s] of SA.entries()) {
        const j = where.get(s);
        if (j === undefined || taken.has(j)) addedOnly.push(i);
        else { pairs.push([j, i]); taken.add(j); }
    }
    return { pairs, addedOnly, removedOnly: B.map((_, i) => i).filter((i) => !taken.has(i)), by: "identity" };
}

/** The `.src` beside an artifact, or undefined when there is none to read. */
function srcOf(artifact: string): string[] | undefined {
    const p = `${artifact}.src`;
    return existsSync(p) ? readRecords(readFileSync(p, "utf8")) : undefined;
}

export function scan(lines: string[], foreign: RegExp | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, re] of DEFECTS) out[name] = lines.filter((l) => re.test(l)).length;
    out["THROW"] = lines.filter((l) => l.startsWith(" THROW")).length;
    if (foreign) out["FOREIGN"] = lines.filter((l) => foreign.test(l)).length;
    return out;
}

/** Only the CLI runs on import; the pairing above is imported by the tests, which must not trip the
 *  usage branch on vitest's own argv. */
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (!isMain) {
    // imported for `readRecords` / `pairRows` / `scan`; nothing to run
} else if (mode === "emit") {
    const lang = flag("lang"), corpus = flag("corpus"), out = flag("out");
    if (!lang || !corpus || !out) throw new Error("emit needs --lang --corpus --out");
    // Imported lazily and by URL so this file can also run inside a pristine worktree, where the import
    // must resolve against THAT checkout's src/ rather than the one this file was authored in.
    const { phonemize } = await import(new URL("../../src/index.ts", import.meta.url).href);
    // `say` is the one place this file knows how to phonemize; defects.ts takes it as a callback so it needs
    // no import of its own and stays testable. It returns undefined on a throw, which the drop test reads as
    // "not comparable" rather than as a difference.
    const say = (t: string): string | undefined => {
        try { return (phonemize(t, lang) as string).replace(/\n/gu, " "); } catch { return undefined; }
    };
    const contribution = makeContribution(say);
    const lines = textLines(corpus);
    const ipa = lines.map((l: string) => {
        let read: string;
        try {
            read = (phonemize(l, lang) as string).replace(/\n/gu, " ");
        } catch (e) {
            return ` THROW ${(e as Error).message}`;
        }
        // The differential DROP test, from defects.ts so all three tools test the same classes. Only an
        // utterance that actually carries a symbol pays for the second phonemize, so the cost is a few
        // percent of the corpus rather than a doubling. A REDUNDANT drop does not count: the DROP column has
        // to keep meaning "a symbol went unspoken", or the Assamese and Malay sentences that already name
        // their currency would make it uninterpretable.
        for (const d of dropsIn(l, read, say, contribution))
            if (!d.redundant) read += ` \u27EADROP:${d.klass}\u27EB`;
        return read;
    });
    writeFileSync(out, `${ipa.join("\n")}\n`);
    // The source text is written alongside so `compare` can pair a reading with the one that came from the
    // same utterance, and categorise a change by what produced it, without needing the corpus reader to
    // agree twice. One line per reading, so the newline is flattened exactly as it is in the IPA above —
    // an artifact whose text carries a literal newline would otherwise put this file out of step with the
    // readings and quietly re-label every example after it. Two of the mined artifacts contain a `\n`
    // escape today; neither survives deduplication into a live segment, which is one artifact away from
    // being untrue.
    writeFileSync(`${out}.src`, `${lines.map((l: string) => l.replace(/\n/gu, " ")).join("\n")}\n`);
    console.log(`emitted ${ipa.length} utterances → ${out}`);
} else if (mode === "compare") {
    const before = flag("before"), after = flag("after");
    if (!before || !after) throw new Error("compare needs --before --after");
    const foreignSrc = flag("foreign");
    const foreign = foreignSrc === undefined ? undefined : new RegExp(foreignSrc, "u");
    const B = readRecords(readFileSync(before, "utf8"));
    const A = readRecords(readFileSync(after, "utf8"));
    const SB = srcOf(before), SA = srcOf(after);
    const pairing = pairRows(B, A, SB, SA);
    if (pairing.by === "position" && pairing.note !== undefined)
        console.log(`  ⓘ paired by POSITION — ${pairing.note}\n`);
    // NOT a throw. A row on one side only is what a corpus that gained or lost a line looks like, and the
    // two sides are still comparable on everything they share; saying so beats refusing to measure. The
    // rows are counted so a large number is impossible to miss, because THAT is what "different corpora"
    // actually looks like.
    if (pairing.addedOnly.length || pairing.removedOnly.length)
        console.log(`  ⚠ UNPAIRED: ${pairing.removedOnly.length} before-only, ${pairing.addedOnly.length} after-only `
            + `(${pairing.by === "identity" ? "by source text" : "beyond the shorter artifact"}) — `
            + `compared on the ${pairing.pairs.length} rows both sides share\n`);
    if (pairing.pairs.length === 0) throw new Error("nothing to compare: the two artifacts share no row");
    const changed = pairing.pairs.filter(([j, i]) => B[j] !== A[i]);
    const N = pairing.pairs.length;
    console.log(`changed ${changed.length}/${N} (${(100 * changed.length / N).toFixed(1)}%)\n`);
    // Scanned over the PAIRED rows on both sides, so the two columns have one denominator. An unpaired row
    // belongs to neither column: counting it would make "before" and "after" totals of different corpora.
    const bLines = pairing.pairs.map(([j]) => B[j] ?? ""), aLines = pairing.pairs.map(([, i]) => A[i] ?? "");
    const b = scan(bLines, foreign), a = scan(aLines, foreign);
    console.log("  before ", b);
    console.log("  after  ", a);
    // A defect count that went UP is the signal to stop and read, not to ship.
    const worse = Object.keys(a).filter((k) => (a[k] ?? 0) > (b[k] ?? 0));
    if (worse.length) console.log(`\n  ⚠ REGRESSED: ${worse.join(", ")} — read the changes before committing`);
    const n = Number(flag("examples") ?? 12);
    console.log(`\nfirst ${Math.min(n, changed.length)} changes:`);
    for (const [j, i] of changed.slice(0, n)) {
        console.log(`  SRC ${SA?.[i]?.slice(0, 76)}`);
        // ⟨empty⟩ rather than a blank line: an utterance the engine read as nothing is the most interesting
        // row a before/after can hold, and it must not look like a formatting glitch.
        console.log(`   -  ${B[j] === "" ? "⟨empty⟩" : B[j]?.slice(0, 92)}`);
        console.log(`   +  ${A[i] === "" ? "⟨empty⟩" : A[i]?.slice(0, 92)}`);
    }
} else {
    console.log(`usage:
  normalization/corpus-diff.ts emit    --lang <code> --corpus <fleurs-dir> --out <file>
  normalization/corpus-diff.ts compare --before <file> --after <file> [--foreign <regex>] [--examples N]

--corpus takes either a FLEURS directory name or 'mined:<lang>' for a committed artifact — which is the only
option for the 87 languages that have no FLEURS corpus.

FLEURS corpora under ${CORPUS_ROOT || "(FLEURS unset)"}:
  ${CORPUS_ROOT === "" ? "— set FLEURS to a corpus root, or use 'mined:<lang>'" : readdirSync(CORPUS_ROOT).join(" ")}

mined artifacts (use as 'mined:<lang>'):
  ${readdirSync(new URL("../corpus/mined/", import.meta.url).pathname).map((f) => f.replace(/\.jsonc$/u, "")).join(" ")}`);
}
