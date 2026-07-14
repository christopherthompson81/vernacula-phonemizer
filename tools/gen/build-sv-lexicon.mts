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

// NST-SAMPA vowel onset symbols (a=a A=ɑ e E=ɛ i I=ɪ o O=ɔ u U y Y }=ʉ 2=ø 9=œ). Length ':' , the 'u0' quality
// modifier '0', diphthong marker '*', retroflex '`', and 'x\' (ɧ) are NOT vowels. Counting these before the
// primary-stress '"' gives the ordinal in terms of VOWEL LETTERS — matching the engine's per-letter nucleus
// counting, so orthographic diphthongs (Europa E*U = two vowels) align instead of being off by one.
const SAMPA_VOWEL = new Set([..."aAeEiIoOuUyY}29"]);
const ORTHO_VOWEL = [..."aeiouyåäöé"]; // engine nucleus letters (must mirror g2p VOWELS)

/** accent (1|2) + 0-based stressed nucleus ordinal + o-quality flag, from an NST SAMPA string + the word.
 *  oLong is true when the STRESSED nucleus is orthographic ⟨o⟩ that NST realises as long [oː] (not the [uː]
 *  the engine defaults to) — the lexical o/u split Swedish spelling underdetermines. Null if no primary stress. */
function parse(word: string, sampa: string): { accent: string; ord: number; oLong: boolean } | null {
    const stress = sampa.indexOf('"');
    if (stress < 0) return null; // clitic / unstressed form
    const accent = sampa.includes('""') ? "2" : "1";
    let ord = 0;
    for (const ch of sampa.slice(0, stress)) if (SAMPA_VOWEL.has(ch)) ord++;
    // The stressed syllable = from the marker to the next syllable boundary; oː override only for orthographic ⟨o⟩.
    const stressedSyl = sampa.slice(stress + 1).split("$")[0]!;
    const orthVowels = [...word].filter((c) => ORTHO_VOWEL.includes(c));
    const oLong = orthVowels[ord] === "o" && stressedSyl.includes("o:");
    return { accent, ord, oLong };
}

// Collect every NST reading per corpus word.
const entries = new Map<string, { accent: string; ord: number; oLong: boolean }[]>();
for (const line of readFileSync(NST, "latin1").split("\n")) {
    const f = line.replace(/\r$/, "").split(";");
    if (f.length < 12) continue;
    const word = f[0]!.toLowerCase();
    if (!corpus.has(word)) continue;
    const p = parse(word, f[11]!);
    if (p) (entries.get(word) ?? entries.set(word, []).get(word)!).push(p);
}

/** Most common value in a list (ties → the value seen first). */
function majority<T>(xs: T[]): T {
    const count = new Map<T, number>();
    for (const x of xs) count.set(x, (count.get(x) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

const out: string[] = [];
let withOrd = 0, withO = 0;
for (const [word, readings] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const accent = majority(readings.map((r) => r.accent));
    const matching = readings.filter((r) => r.accent === accent);
    const ord = majority(matching.map((r) => r.ord)); // stress ordinal among majority-accent readings
    const oLong = majority(matching.map((r) => r.oLong));
    // Tokens after accent: a number is the stress ordinal (omitted when 0 = first syllable = engine default);
    // "o" flags a stressed long ⟨o⟩ → [oː] (engine defaults to [uː]).
    const tokens = [accent];
    if (ord > 0) { tokens.push(String(ord)); withOrd++; }
    if (oLong) { tokens.push("o"); withO++; }
    out.push(`${word}\t${tokens.join("\t")}`);
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${out.length} corpus words, ${withOrd} non-initial stress, ${withO} oː-override`);
