/**
 * Build the Swedish accent lexicon from the CC0 NST Pronunciation Lexicon (swe030224NST.pron).
 * We take only CONVENTION-INDEPENDENT abstract features (NOT the NST/espeak segments):
 *   - pitch accent (1|2): NST field 12 SAMPA primary-stress marker — `""` = accent 2, `"` = accent 1.
 *   - primary-stress ORDINAL (0-based syllable index): the `$`-delimited syllable that carries the `"` marker.
 * Restricted to the 50k frequency corpus (the same compaction); homographs resolve by
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
const EP = process.env["ESPEAK_PORTABLE"] ?? "";  // set to the reference-engine checkout
const NST = arg("nst", `${EP}/tools/corpus/.cache/sv/NST svensk leksikon/swe030224NST.pron/swe030224NST.pron`);
const CORPUS = arg("corpus", `${EP}/tools/qa-compare/words-50000.sv.txt`);
const OUT = "data/languages/swedish/accent-stress.tsv";

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
interface Parsed {
    accent: string;
    ord: number;
    oLong: boolean;
    secOrd: number; // secondary-stress (%) nucleus ordinal, or -1 (simplex / no secondary stress = no compound)
    longOrds: number[]; // ordinals of every NST-long vowel (drives compound length boundary-safely); [] if simplex
    secVowelInitial: boolean; // secondary element is vowel-initial (björk|ö) → the preceding C is a CODA, keep hard
}
/** Count SAMPA vowels before position p → the 0-based nucleus ordinal of the marker at p. */
const ordAt = (sampa: string, p: number): number =>
    [...sampa.slice(0, p)].filter((c) => SAMPA_VOWEL.has(c)).length;
/** Ordinals of every long vowel in the SAMPA: a vowel (+ optional u0 quality modifier) immediately before ':'. */
function longOrdsOf(sampa: string): number[] {
    const chars = [...sampa];
    const out: number[] = [];
    let ord = 0;
    for (let k = 0; k < chars.length; k++) {
        if (!SAMPA_VOWEL.has(chars[k]!)) continue;
        const after = chars[k + 1] === "0" ? chars[k + 2] : chars[k + 1];
        if (after === ":") out.push(ord);
        ord++;
    }
    return out;
}

function parse(word: string, sampa: string): Parsed | null {
    const stress = sampa.indexOf('"');
    if (stress < 0) return null; // clitic / unstressed form
    const accent = sampa.includes('""') ? "2" : "1";
    const ord = ordAt(sampa, stress);
    // The stressed syllable = from the marker to the next syllable boundary; oː override only for orthographic ⟨o⟩.
    const stressedSyl = sampa.slice(stress + 1).split("$")[0]!;
    const orthVowels = [...word].filter((c) => ORTHO_VOWEL.includes(c));
    // The ordinal indexes orthVowels, so it is only trustworthy when NST's vowels line up with the word's. A
    // PRE-stress mismatch (NST consonantises ⟨eu⟩ → ne$vrU, dropping a vowel BEFORE the stress) shifts every
    // index and lands oː on the wrong ⟨o⟩ — withhold. A POST-stress mismatch is harmless: a loanword's silent
    // final ⟨e⟩ (adobe → a"do:b, pose → "po:s) drops a vowel AFTER the stressed ⟨o⟩, so the ordinal still holds.
    const sampaVowels = [...sampa].filter((c) => SAMPA_VOWEL.has(c)).length;
    let effectiveOrtho = orthVowels.length;
    if (word.endsWith("e") && effectiveOrtho === sampaVowels + 1) effectiveOrtho--; // absorb one trailing silent ⟨e⟩
    const aligned = sampaVowels === effectiveOrtho;
    const oLong = aligned && orthVowels[ord] === "o" && stressedSyl.includes("o:");
    // Secondary stress (%) → compound prosody. Only trustworthy when the SAMPA/ortho vowels align (same reason as
    // oLong). The length of the primary & secondary stressed vowels comes from NST (its ':') so compound length is
    // boundary-safe instead of the engine's boundary-unaware coda rule.
    const pct = sampa.indexOf("%");
    let secOrd = -1,
        longOrds: number[] = [],
        secVowelInitial = false;
    if (pct >= 0 && aligned) {
        secOrd = ordAt(sampa, pct);
        longOrds = longOrdsOf(sampa);
        secVowelInitial = SAMPA_VOWEL.has(sampa[pct + 1] ?? ""); // %V… → vowel-initial second element
    }
    return { accent, ord, oLong, secOrd, longOrds, secVowelInitial };
}

// Collect every NST reading per corpus word.
const entries = new Map<string, Parsed[]>();
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

// NST inconsistently marks the tens 30–80 (trettio…åttio) as accent 1 while giving 10/20/90 (tio/tjugo/nittio)
// accent 2 — but the compound numerals X+tio are all accent 2 in standard Swedish (independent wikipron ² confirms
// trettio…åttio). Correct that NST quirk so the whole tens series is internally consistent and canonical.
const ACCENT2_NUMERALS = new Set(["trettio", "fyrtio", "femtio", "sextio", "sjuttio", "åttio"]);

const out: string[] = [];
let withOrd = 0, withO = 0, withSec = 0;
for (const [word, readings] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const accent = ACCENT2_NUMERALS.has(word)
        ? "2"
        : majority(readings.map((r) => r.accent));
    // ord/oLong from the readings at the chosen accent; if the accent override left none, use all readings.
    const atAccent = readings.filter((r) => r.accent === accent);
    const matching = atAccent.length > 0 ? atAccent : readings;
    const ord = majority(matching.map((r) => r.ord)); // stress ordinal among majority-accent readings
    const oLong = majority(matching.map((r) => r.oLong));
    // Compound prosody: vote the secondary ordinal among readings that HAVE one (a `%`); the long-vowel set comes
    // from those same readings. A word split between compound/simplex readings keeps the compound one if it wins.
    const secReadings = matching.filter((r) => r.secOrd >= 0);
    const secOrd = secReadings.length > matching.length / 2 ? majority(secReadings.map((r) => r.secOrd)) : -1;
    const secMatch = secReadings.filter((r) => r.secOrd === secOrd);
    const longOrds =
        secOrd >= 0 ? majority(secMatch.map((r) => r.longOrds.join(","))) : "";
    const secVowelInitial =
        secOrd >= 0 && majority(secMatch.map((r) => r.secVowelInitial));
    // Tokens after accent: a number = the stress ordinal (omitted when 0 = first syllable = engine default);
    // "o" flags a stressed long ⟨o⟩ → [oː]; "s<N>" the secondary-stress nucleus; "L<ords>" the NST-long vowel
    // ordinals (comma-sep) that drive boundary-safe compound length.
    const tokens = [accent];
    if (ord > 0) { tokens.push(String(ord)); withOrd++; }
    if (oLong) { tokens.push("o"); withO++; }
    if (secOrd >= 0) {
        tokens.push(`s${secOrd}`);
        if (longOrds) tokens.push(`L${longOrds}`);
        if (secVowelInitial) tokens.push("vi"); // suppress secondary-onset softening (preceding C is a coda)
        withSec++;
    }
    out.push(`${word}\t${tokens.join("\t")}`);
}
writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${out.length} corpus words, ${withOrd} non-initial stress, ${withO} oː-override, ${withSec} secondary stress`);
