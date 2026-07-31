/**
 * MINE a normalization hard-set from running text (#585) — build the corpus the diff gate needs for a
 * language that has no FLEURS corpus.
 *
 * WHY SELECTION AND NOT A DUMP. An exhaustive dump is the wrong target: most sentences exercise nothing the
 * normalizer does, and size is not the property we want. The property we want is COVERAGE of the pattern
 * inventory below, which is not invented here — it is the empirical shape of the 338 numbered rules across
 * the 37 languages already treated under #562. Each cell of that inventory exists because a real corpus
 * instance broke an engine. So the corpus is complete when every cell holds a few real examples, which
 * gives a stopping criterion that does not depend on how much text was fetched.
 *
 * ⚠ THE SELECTORS ARE NOT ASCII-ONLY, AND THIS IS THE WHOLE TRAP. `\d` under the `u` flag matches ASCII
 * 0-9 and nothing else, so a selector built on it silently returns an empty hard-set for Burmese (၀-၉),
 * Devanagari (०-९), Thai (๐-๙), Bengali (০-৯) and Arabic-Indic (٠-٩) — i.e. for exactly the languages most
 * likely to need one, while appearing to work. Every pattern here uses `\p{Nd}`. This is the same trap
 * family as `\b` being ASCII-defined, which bit the initialism pass repeatedly and is ranked in the
 * playbook. `--audit-ascii` reports what an ASCII-only run would have missed, so the cost stays visible.
 *
 * TWO TIERS, because selection destroys frequency. `--sample N` additionally emits a uniform random sample,
 * which the mined set cannot substitute for: on a selected set an instance count means nothing (the
 * Vietnamese `ây` gap was worth fixing because it was 22.1% OF THE CORPUS), and a hard-cases-only corpus
 * proves the rules fire without proving ordinary text still survives.
 *
 * Usage:
 *   npx tsx tools/normalization-mine.ts --in raw.txt --out my.hard.txt [--per-cell 8] [--sample 200]
 *       [--terminators "။"] [--audit-ascii]
 */
import { readFileSync, writeFileSync } from "node:fs";

/**
 * THE PATTERN INVENTORY. Keyed by the rule category it stands for, with the count of treated languages
 * that authored a rule in that category — the mining priority is that count, since a cell 22 languages
 * needed is a cell the next language probably needs too.
 */
const CELLS: { key: string; langs: number; re: RegExp }[] = [
    { key: "degrees", langs: 22, re: /\p{Nd}\s*(?:°|℃|℉)/u },
    { key: "digit-run", langs: 19, re: /\p{Nd}{4,}/u },
    { key: "fractions", langs: 18, re: /\p{Nd}\s*[\/⁄]\s*\p{Nd}|[½¼¾⅓⅔⅛]/u },
    { key: "clock", langs: 18, re: /\p{Nd}{1,2}\s*[:.]\s*\p{Nd}{2}\b/u },
    { key: "signs", langs: 17, re: /[%‰+±×÷=<>]|\p{Sc}/u },
    { key: "dotted", langs: 16, re: /\p{L}\.\s*\p{L}\./u },
    { key: "era-date", langs: 14, re: /\p{Nd}{4}(?!\p{Nd})|\p{Nd}{1,2}[.\/-]\p{Nd}{1,2}[.\/-]\p{Nd}{2,4}/u },
    { key: "decimals", langs: 12, re: /\p{Nd}[.,]\p{Nd}/u },
    { key: "ordinals", langs: 11, re: /\p{Nd}+(?:st|nd|rd|th|er|re|ème|º|ª|\.|:e)(?![\p{L}\p{Nd}])/u },
    { key: "units", langs: 9, re: /\p{Nd}\s*(?:km|kg|cm|mm|ml|mg|GB|MB|kHz|MHz|GHz|kW|m²|km²|m³)/iu },
    { key: "ranges", langs: 7, re: /\p{Nd}\s*[–—-]\s*\p{Nd}/u },
    { key: "currency", langs: 6, re: /\p{Sc}\s*\p{Nd}|\p{Nd}\s*\p{Sc}/u },
    { key: "abbrev", langs: 6, re: /(?<![\p{L}\p{M}])\p{L}{1,4}\.(?=\s+\p{L})/u },
    { key: "latin-in-native", langs: 6, re: /[A-Za-z]{2,}/u },
    { key: "percent", langs: 5, re: /\p{Nd}\s*[%‰]/u },
    { key: "rate", langs: 4, re: /\p{Nd}\s*\p{L}+\s*\/\s*\p{L}+/u },
    { key: "zero-width", langs: 4, re: /[\u200B-\u200D\u2060\uFEFF]/u },
    { key: "roman", langs: 3, re: /(?<![\p{L}\p{M}])(?=[MDCLXVI]{2,})M*(?:C[MD]|D?C{0,3})(?:X[CL]|L?X{0,3})(?:I[XV]|V?I{0,3})(?![\p{L}\p{M}])/u },
    { key: "initialism", langs: 3, re: /(?<![\p{L}\p{M}])\p{Lu}{2,}(?![\p{L}\p{M}])/u },
    { key: "grouped", langs: 3, re: /\p{Nd}{1,3}(?:[,. \u00a0]\p{Nd}{3})+(?![\p{Nd}])/u },
];

/** The ASCII-only counterpart of each digit-bearing cell, used only by --audit-ascii. */
const asciiVariant = (re: RegExp): RegExp => new RegExp(re.source.replace(/\\p\{Nd\}/gu, "\\d"), re.flags);

const arg = (name: string, dflt?: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? dflt : process.argv[i + 1];
};
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const inPath = arg("in");
const outPath = arg("out");
if (inPath === undefined || outPath === undefined) {
    console.error("usage: --in raw.txt --out hard.txt [--per-cell 8] [--sample 200] [--terminators \"။\"] [--audit-ascii]");
    process.exit(2);
}
const perCell = Number(arg("per-cell", "8"));
const sampleN = Number(arg("sample", "0"));
// Sentence terminators. ASCII plus the marks used by the scripts treated so far; a language whose
// terminator is absent here passes it with --terminators rather than getting one giant "sentence".
const terminators = arg("terminators", ".!?။።۔؟।॥…。！？៕");

const raw = readFileSync(inPath, "utf8");
const splitter = new RegExp(`[^${terminators.replace(/[\\\]^-]/gu, "\\$&")}]+[${terminators.replace(/[\\\]^-]/gu, "\\$&")}]*`, "gu");
const sentences = [...new Set(
    [...raw.matchAll(splitter)]
        .map((m) => m[0].replace(/\s+/gu, " ").trim())
        // Length bounds: a fragment shorter than this carries no context for a rule to be judged in, and a
        // very long one is usually a table or a list that slipped through the plain-text extraction.
        .filter((s) => s.length >= 20 && s.length <= 400),
)];

interface Hit { cell: string; sentence: string }
const picked: Hit[] = [];
const counts = new Map<string, number>();
const asciiCounts = new Map<string, number>();

for (const { key, re } of CELLS) {
    const ascii = asciiVariant(re);
    let taken = 0;
    for (const s of sentences) {
        if (!re.test(s)) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (ascii.test(s)) asciiCounts.set(key, (asciiCounts.get(key) ?? 0) + 1);
        // Prefer sentences not already picked, so the hard-set covers cells rather than repeating one
        // information-dense sentence that happens to satisfy many of them.
        if (taken < perCell && !picked.some((p) => p.sentence === s)) {
            picked.push({ cell: key, sentence: s });
            taken++;
        }
    }
}

console.log(`sentences: ${sentences.length} unique\n`);
console.log("cell             langs   matched   picked   ascii-only-would-find");
for (const { key, langs } of CELLS) {
    const n = counts.get(key) ?? 0;
    const a = asciiCounts.get(key) ?? 0;
    const pk = picked.filter((p) => p.cell === key).length;
    const flag = n > 0 && a === 0 ? "  ← ASCII BLIND" : n > 0 && a < n ? `  (${n - a} missed)` : "";
    console.log(`${key.padEnd(16)} ${String(langs).padStart(3)}   ${String(n).padStart(7)}   ${String(pk).padStart(6)}   ${String(a).padStart(9)}${flag}`);
}
const empty = CELLS.filter((c) => (counts.get(c.key) ?? 0) === 0).map((c) => c.key);
console.log(`\ncovered ${CELLS.length - empty.length}/${CELLS.length} cells; EMPTY: ${empty.join(" ") || "none"}`);

const lines = picked.map((p) => `${p.cell}\t${p.sentence}`);
if (sampleN > 0) {
    // Deterministic stride rather than a shuffle — reproducible, and no Math.random.
    const stride = Math.max(1, Math.floor(sentences.length / sampleN));
    for (let i = 0; i < sentences.length && lines.length < picked.length + sampleN; i += stride) {
        lines.push(`sample\t${sentences[i]}`);
    }
}
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`wrote ${lines.length} lines → ${outPath}`);
