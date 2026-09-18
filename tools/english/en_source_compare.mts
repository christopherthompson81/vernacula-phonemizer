/**
 * FREQUENCY-RANKED TRIPLE-SOURCE AUDIT of the English dictionary.
 *
 * The wikipron referee covers 1,439 of the 40,004 words in `g2p-common.txt` — 3.6%. The other 96% of the
 * words that actually occur in text have never been checked against anything. This compares every frequency
 * word against TWO sources with different ancestry, and flags where BOTH agree against us:
 *
 *   • misaki `us_gold.json` — CMUdict plus heavy hand curation; the lexicon Kokoro was trained on (Apache-2.0)
 *   • Moby Pronunciator II  — independent of both CMUdict and Wiktionary; public domain by the author's
 *                             2001 grant (Project Gutenberg #3205). See data/LICENSES/PROVENANCE.md §5.3.
 *
 * Neither is redistributed: both are read from disk and used to DECIDE, and the decisions land in this
 * repo's own CMUdict-derived files.
 *
 *   MOBY=/path/to/mobypron.unc GOLD=/path/to/us_gold.json npx tsx tools/english/en_source_compare.mts
 *
 * ⚠ THE NORMALISATION IS THE WHOLE INSTRUMENT, and three separate attempts at it gave 1,005, 663 and 609
 * candidates before it was right. Each wrong version would have generated hundreds of false "fixes":
 *
 *   1. STRESS MUST BE STRIPPED FIRST. Keeping it made the top-frequency hits almost entirely FUNCTION WORDS
 *      differing only in the digit — `of` AH1 V against AH0 V, and the same for `to`, `is`, `with`, `you`,
 *      `it`, `or`, `are`, `from`, `at`, `as`, `an`, `was`, `we`, `if`, `they`, `he`. This engine de-accents
 *      those at the PHRASE layer (english.jsonc `unstressedWords`), so the dictionary's stress-1 is the
 *      correct CITATION form and the difference is not a defect at all.
 *   2. AH AND IH THEN MERGE, because that pair IS this engine's declared weak-vowel convention: it writes
 *      AH0 where gold and Moby write IH0 (`message`, `package`, `village`, `artist`, `basis`) and renders it
 *      `ᵻ`. Leaving them apart buries the real signal under one settled axis.
 *   3. ⚠ ORDER MATTERS AND IS NOT INTERCHANGEABLE. A reduction rule applied BEFORE stripping stress is
 *      itself stress-dependent — "unstressed vowel → schwa" reintroduces exactly the function-word noise
 *      that step 1 removes. Strip first, merge second.
 *
 * ⚠ ER IS DELIBERATELY NOT MERGED with AH/IH: `ɚ` against `ə` is a real distinction, not a notation one.
 *
 * ⚠ AND MOBY IS PRE-MERGER — it keeps FORCE apart from NORTH (`aboard`, `adore`, `airport` with `oU r`
 * where GenAm merged them) and the conservative yod (`seizure` as Z Y UW R). `modernise` folds both before
 * it may vote. Its conservatism is also why it is an ARBITER and NOT a scored referee: 86% of the words in
 * `en-gb-marry.tsv` are unmerged in Moby, so a headline scored against it would punish correct
 * modernisation.
 */
import { readFileSync } from "node:fs";

// ── source converters ────────────────────────────────────────────────────────────────────────────────

const GOLD_UNITS: [string, string][] = [
    ["ɜɹ", "ER"], ["əɹ", "ER"],
    ["A", "EY"], ["I", "AY"], ["O", "OW"], ["W", "AW"], ["Y", "OY"],
    ["i", "IY"], ["u", "UW"], ["ɑ", "AA"], ["ɔ", "AO"], ["æ", "AE"], ["ɛ", "EH"],
    ["ɪ", "IH"], ["ʊ", "UH"], ["ʌ", "AH"], ["ə", "AH"], ["ᵊ", "AH"], ["ᵻ", "AH"],
    ["ʤ", "JH"], ["ʧ", "CH"], ["ʃ", "SH"], ["ʒ", "ZH"], ["θ", "TH"], ["ð", "DH"],
    ["ŋ", "NG"], ["ɡ", "G"], ["ɹ", "R"], ["ɾ", "T"], ["j", "Y"],
    ["b", "B"], ["d", "D"], ["f", "F"], ["h", "HH"], ["k", "K"], ["l", "L"],
    ["m", "M"], ["n", "N"], ["p", "P"], ["s", "S"], ["t", "T"], ["v", "V"],
    ["w", "W"], ["z", "Z"], ["ʔ", "T"],
];
const VOWELS = new Set(["EY", "AY", "OW", "AW", "OY", "IY", "UW", "AA", "AO", "AE", "EH", "IH", "UH", "AH", "ER"]);

/** misaki gold IPA → ARPABET. `undefined` when any symbol is unmappable — better no vote than a partial one. */
export function goldToArpabet(g: string): string[] | undefined {
    const out: string[] = [];
    let stress = "0";
    for (let i = 0; i < g.length; ) {
        const c = g[i]!;
        if (c === "ˈ") { stress = "1"; i++; continue; }
        if (c === "ˌ") { stress = "2"; i++; continue; }
        if (c === "ː" || c === " ") { i++; continue; }
        const hit = GOLD_UNITS.find(([s]) => g.startsWith(s, i));
        if (!hit) return undefined;
        const [sym, arp] = hit;
        i += sym.length;
        if (VOWELS.has(arp)) { out.push(arp + stress); stress = "0"; } else out.push(arp);
    }
    return out.length ? out : undefined;
}

const M_V: Record<string, string> = {
    A: "AA", "&": "AE", "@": "AH", O: "AO", AU: "AW", aI: "AY", E: "EH",
    "[@]": "ER", eI: "EY", I: "IH", i: "IY", oU: "OW", OI: "OY", U: "UH", u: "UW",
    "(@)": "EH", // the `Aaron` vowel: variable æ~ɛ before intervocalic r
};
const M_C: Record<string, string> = {
    T: "TH", D: "DH", S: "SH", Z: "ZH", dZ: "JH", tS: "CH", N: "NG", j: "Y", x: "K", z: "Z", hw: "W",
};
const M_RAW: Record<string, string> = {
    b: "B", d: "D", f: "F", g: "G", h: "HH", k: "K", l: "L", m: "M",
    n: "N", p: "P", r: "R", s: "S", t: "T", v: "V", w: "W", z: "Z",
};

/** Moby notation → ARPABET. `undefined` for multi-word entries and for its French sub-scheme (raw capitals). */
export function mobyToArpabet(p: string): string[] | undefined {
    // ⚠ OY is written `//Oi//` throughout the file, never `/OI/`. Un-normalised it tokenises as two empty
    // slash-pairs plus a raw `Oi`, which is where the file's 5,389 stray `//` come from.
    const s = p.replace(/\/\/Oi\/\//gu, "/OI/");
    if (/_/u.test(s)) return undefined;
    if (/[AONYWVSZR]/u.test(s.replace(/\/[^/]*\//gu, ""))) return undefined;
    const out: string[] = [];
    let stress = "0";
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (c === "'") { stress = "1"; i++; continue; }
        if (c === ",") { stress = "2"; i++; continue; }
        if (c === "/") {
            const j = s.indexOf("/", i + 1);
            if (j < 0) return undefined;
            const sym = s.slice(i + 1, j);
            i = j + 1;
            if (sym === "") continue;
            if (sym === "-") { out.push("AH0"); continue; }        // syllabic consonant: /-/n = ə + n
            if (M_V[sym] !== undefined) {
                out.push(M_V[sym]! + stress); stress = "0";
                // ⚠ `/[@]/` IS THE NURSE *VOWEL* ALONE and Moby writes its /r/ SEPARATELY — `person` is
                // 'p/[@]/rs/@/n, `bird` is b/[@]/rd. Without consuming that `r`, every NURSE word came out
                // with a DOUBLED rhotic (`P ER1 R S AH0 N`), which silently pushed the whole class out of
                // the candidate set and into "split". Caught by the converter test, not by the audit.
                if (sym === "[@]" && s[i] === "r") i++;
                continue;
            }
            if (M_C[sym] !== undefined) { out.push(M_C[sym]!); continue; }
            if (sym === "ju") { out.push("Y", "UW" + stress); stress = "0"; continue; }
            return undefined;
        }
        if (M_RAW[c] !== undefined) { out.push(M_RAW[c]!); i++; continue; }
        return undefined;
    }
    return out.length ? out : undefined;
}

/** Fold Moby's pre-merger layers so it can vote on modern GenAm. See the header. */
export function modernise(a: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) {
        const p = a[i]!, b = p.replace(/[0-2]$/u, ""), st = p.slice(b.length);
        if (b === "OW" && a[i + 1] === "R") { out.push(`AO${st}`); continue; }   // FORCE → NORTH
        if (b === "Y" && out.length > 0 && a[i + 1]?.startsWith("UW")) {
            const prev = out[out.length - 1]!;
            const co: Record<string, string> = { Z: "ZH", S: "SH", T: "CH", D: "JH" };
            if (co[prev] !== undefined) { out[out.length - 1] = co[prev]!; continue; } // yod coalescence
            if (prev === "N" || prev === "L" || prev === "TH") continue;               // yod dropping
        }
        out.push(p);
    }
    return out;
}

// ── the normalisation ────────────────────────────────────────────────────────────────────────────────

/**
 * The comparison form. Strip stress FIRST, then merge AH/IH — see the header for why the order is not
 * interchangeable and why each step is there.
 */
export function normalise(a: string[]): string {
    return a
        .map((x) => x.replace(/[0-2]$/u, ""))
        .map((b) => (b === "AH" || b === "IH" ? "ə" : b))
        .join(" ");
}

// ── the audit ────────────────────────────────────────────────────────────────────────────────────────

export interface Candidate { rank: number; word: string; ours: string[]; agreed: string[] }

export function audit(dictPath: string, freqPath: string, goldPath: string, mobyPath: string): {
    compared: number; agree: number; candidates: Candidate[]; split: number;
} {
    const dict = new Map<string, string[]>();
    for (const l of readFileSync(dictPath, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, p] = l.split("\t");
        dict.set(w!.toLowerCase(), p!.split(" "));
    }
    const gold: Record<string, unknown> = JSON.parse(readFileSync(goldPath, "utf8"));
    const goldOf = (w: string): string | undefined => {
        const v = gold[w] ?? gold[w[0]!.toUpperCase() + w.slice(1)];
        // ⚠ An object value is a POS-conditioned HETERONYM; our row is a single reading, so a mismatch there
        // is not a defect. Skipped rather than guessed at.
        return typeof v === "string" ? v : undefined;
    };
    const moby = new Map<string, string[][]>();
    // ⚠ CR-DELIMITED. `mobypron.unc` uses classic-Mac line endings, so splitting on "\n" returns ONE line
    // and the audit silently compares nothing — it reported 0 words before this was found. Split on all three.
    for (const line of readFileSync(mobyPath, "latin1").split(/\r\n|\r|\n/u)) {
        const sp = line.indexOf(" ");
        if (sp < 0) continue;
        const w = line.slice(0, sp).toLowerCase();
        const a = mobyToArpabet(line.slice(sp + 1));
        if (a) (moby.get(w) ?? moby.set(w, []).get(w)!).push(a);
    }
    const freq = readFileSync(freqPath, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
    let compared = 0, agree = 0, split = 0;
    const candidates: Candidate[] = [];
    freq.forEach((w, rank) => {
        const ours = dict.get(w), g = goldOf(w), m = moby.get(w);
        if (!ours || !g || !m) return;
        const ga = goldToArpabet(g);
        if (!ga) return;
        compared++;
        const o = normalise(ours), gg = normalise(ga);
        const ms = m.map((p) => normalise(modernise(p)));
        if (gg === o && ms.includes(o)) { agree++; return; }
        if (gg !== o && ms.includes(gg)) { candidates.push({ rank, word: w, ours, agreed: ga }); return; }
        split++;
    });
    return { compared, agree, candidates, split };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const moby = process.env["MOBY"];
    if (!moby) throw new Error("set MOBY to a mobypron.unc path (Project Gutenberg #3205)");
    const gold = process.env["GOLD"] ?? "";
    if (!gold) throw new Error("set GOLD to a misaki us_gold.json path");
    const r = audit("data/languages/english/g2p-dict.tsv", "data/languages/english/g2p-common.txt", gold, moby);
    const pc = (n: number): string => `${((100 * n) / r.compared).toFixed(1)}%`;
    console.log(`triple-sourced frequency words: ${r.compared}`);
    console.log(`  all three agree:                  ${r.agree} (${pc(r.agree)})`);
    console.log(`  gold AND Moby agree AGAINST us:   ${r.candidates.length} (${pc(r.candidates.length)})`);
    console.log(`  split / no majority:              ${r.split} (${pc(r.split)})`);
    for (const [lab, lo, hi] of [["top 1k", 0, 1000], ["1k–5k", 1000, 5000], ["5k–20k", 5000, 20000], ["20k–40k", 20000, Infinity]] as const)
        console.log(`    ${lab.padEnd(9)} ${r.candidates.filter((c) => c.rank >= lo && c.rank < hi).length}`);
    for (const c of r.candidates.sort((a, b) => a.rank - b.rank))
        console.log(`${c.rank}\t${c.word}\t${c.ours.join(" ")}\t${c.agreed.join(" ")}`);
}
