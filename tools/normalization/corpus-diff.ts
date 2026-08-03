/**
 * CORPUS BEFORE/AFTER DIFF for a normalization change (#562) — the verification gate that caught more real
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
 * docs/normalization_playbook.md, which sets the worktree up once for the whole fan-out.
 *
 * THE DEFECT CLASSES are the ones the thirteen languages kept producing. A rule that looks right on a
 * handful of probes still lands these at corpus scale:
 *   DIGIT     an ASCII digit survived into the IPA — the number path declined and leaked its input
 *   SLOT-GAP  a double/leading/trailing space, almost always a padded `clausePunctuation` value
 *   RAWMARK   a punctuation or symbol character reached the phoneme string
 *   THROW     the engine raised on an input it used to accept
 * `--foreign` additionally counts utterances carrying phonemes outside the language's own inventory, which
 * is what the embedded-Latin fallback produces (see core/foreign.ts); pass it a regex of foreign phonemes.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dropsIn, makeContribution } from "./defects.ts";
import { join } from "node:path";

const CORPUS_ROOT = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
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
function corpusLines(corpus: string): string[] {
    const dir = join(CORPUS_ROOT, corpus);
    const seen = new Set<string>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
        for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
            const col = line.split("\t")[TEXT_COLUMN];
            if (col !== undefined && col !== "") seen.add(col);
        }
    return [...seen];
}

const DEFECTS: [string, RegExp][] = [
    // `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so this class was blind to
    // a digit leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯,
    // Khmer, Lao. RAWMARK below happened to list the Devanagari, Arabic-Indic and Persian ranges, which
    // made the gap look smaller than it was: those three scripts were covered by accident and the rest
    // were not covered at all. Found while mining a Burmese hard-set (#585).
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
    // them can see one that is silently DISCARDED, and that blind spot is why the currency drop in #584
    // went unnoticed through thirty-seven languages of corpus-driven work. `emit` appends this marker
    // after phonemizing the utterance a second time with the symbol deleted and finding the two readings
    // identical — proof the symbol contributed nothing.
    ["DROP", /\u27EADROP:/u],
];

// The defect tables and the REDUNDANT discrimination live in `defects.ts`, shared with `mine.ts scan`
// and `coverage.ts`. They were three copies and they had DRIFTED — this file's `minus` class was missing
// the EN DASH, and it had no `math-sign`, `exponent`, `ampersand` or `iteration` class at all, so the
// gate could not see a dropped `&` or `²`. See that file's header for the full table.

function scan(lines: string[], foreign: RegExp | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, re] of DEFECTS) out[name] = lines.filter((l) => re.test(l)).length;
    out["THROW"] = lines.filter((l) => l.startsWith(" THROW")).length;
    if (foreign) out["FOREIGN"] = lines.filter((l) => foreign.test(l)).length;
    return out;
}

if (mode === "emit") {
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
    const lines = corpusLines(corpus);
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
    // The source text is written alongside so `compare` can categorise a change by what produced it
    // without needing the corpus reader to agree twice.
    writeFileSync(`${out}.src`, `${lines.join("\n")}\n`);
    console.log(`emitted ${ipa.length} utterances → ${out}`);
} else if (mode === "compare") {
    const before = flag("before"), after = flag("after");
    if (!before || !after) throw new Error("compare needs --before --after");
    const foreignSrc = flag("foreign");
    const foreign = foreignSrc === undefined ? undefined : new RegExp(foreignSrc, "u");
    const B = readFileSync(before, "utf8").split("\n").filter((l) => l !== "");
    const A = readFileSync(after, "utf8").split("\n").filter((l) => l !== "");
    const S = readFileSync(`${after}.src`, "utf8").split("\n").filter((l) => l !== "");
    if (A.length !== B.length)
        throw new Error(`length mismatch: before ${B.length}, after ${A.length} — different corpora?`);
    const changed = A.map((_, i) => i).filter((i) => A[i] !== B[i]);
    console.log(`changed ${changed.length}/${A.length} (${(100 * changed.length / A.length).toFixed(1)}%)\n`);
    console.log("  before ", scan(B, foreign));
    console.log("  after  ", scan(A, foreign));
    // A defect count that went UP is the signal to stop and read, not to ship.
    const b = scan(B, foreign), a = scan(A, foreign);
    const worse = Object.keys(a).filter((k) => (a[k] ?? 0) > (b[k] ?? 0));
    if (worse.length) console.log(`\n  ⚠ REGRESSED: ${worse.join(", ")} — read the changes before committing`);
    const n = Number(flag("examples") ?? 12);
    console.log(`\nfirst ${Math.min(n, changed.length)} changes:`);
    for (const i of changed.slice(0, n)) {
        console.log(`  SRC ${S[i]?.slice(0, 76)}`);
        console.log(`   -  ${B[i]?.slice(0, 92)}`);
        console.log(`   +  ${A[i]?.slice(0, 92)}`);
    }
} else {
    console.log(`usage:
  normalization/corpus-diff.ts emit    --lang <code> --corpus <fleurs-dir> --out <file>
  normalization/corpus-diff.ts compare --before <file> --after <file> [--foreign <regex>] [--examples N]

corpora available under ${CORPUS_ROOT}:
  ${readdirSync(CORPUS_ROOT).join(" ")}`);
}
