/**
 * Build the vernacula Swedish Phase-2 lexicon from the CC0 NST Pronunciation Lexicon (swe030224NST.pron).
 * We take only CONVENTION-INDEPENDENT abstract features (NOT the NST/espeak segments):
 *   - pitch accent (1|2): NST field 12 SAMPA primary-stress marker — `""` = accent 2, `"` = accent 1.
 *   - primary-stress ORDINAL (0-based syllable index): the `$`-delimited syllable that carries the `"` marker.
 * Restricted to the 50k frequency corpus (mirrors espeak-ng-portable's compaction); homographs resolve by
 * majority. Output: src/languages/swedish/accent-stress.tsv — word<TAB>accent<TAB>stressOrd (ord omitted when 0,
 * i.e. first-syllable = the engine default). NST is CC0; only the derived abstract features are committed.
 *
 * Usage: npx tsx tools/gen/build-sv-lexicon.mts [--nst <path>] [--corpus <path>]
 */
import { readFileSync, writeFileSync } from "node:fs";

function arg(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const EP = "/home/chris/Programming/espeak-ng-portable";
const NST = arg("nst", `${EP}/tools/corpus/.cache/sv/NST svensk leksikon/swe030224NST.pron/swe030224NST.pron`);
const CORPUS = arg("corpus", `${EP}/tools/qa-compare/words-50000.sv.txt`);
const OUT = "src/languages/swedish/accent-stress.tsv";

const corpus = new Set(readFileSync(CORPUS, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean));

/** accent (1|2) + 0-based stressed-syllable ordinal from an NST SAMPA string, or null if no primary stress. */
function parse(sampa: string): { accent: string; ord: number } | null {
    if (!sampa.includes('"')) return null; // clitic / unstressed form
    const accent = sampa.includes('""') ? "2" : "1";
    const syls = sampa.split("$");
    const ord = syls.findIndex((s) => s.includes('"'));
    return ord < 0 ? null : { accent, ord };
}

// Collect every NST reading per corpus word.
const entries = new Map<string, { accent: string; ord: number }[]>();
for (const line of readFileSync(NST, "latin1").split("\n")) {
    const f = line.replace(/\r$/, "").split(";");
    if (f.length < 12) continue;
    const word = f[0]!.toLowerCase();
    if (!corpus.has(word)) continue;
    const p = parse(f[11]!);
    if (p) (entries.get(word) ?? entries.set(word, []).get(word)!).push(p);
}

/** Most common value in a list (ties → the value seen first). */
function majority<T>(xs: T[]): T {
    const count = new Map<T, number>();
    for (const x of xs) count.set(x, (count.get(x) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

const out: string[] = [];
let withOrd = 0;
for (const [word, readings] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const accent = majority(readings.map((r) => r.accent));
    // stress ordinal among the readings that match the majority accent
    const ord = majority(readings.filter((r) => r.accent === accent).map((r) => r.ord));
    if (ord > 0) {
        out.push(`${word}\t${accent}\t${ord}`);
        withOrd++;
    } else out.push(`${word}\t${accent}`);
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${out.length} corpus words, ${withOrd} with a non-initial stress ordinal`);
