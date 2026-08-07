/**
 * English cleanroom G2P — a JOINT-SEQUENCE N-GRAM model (Sequitur-style), the
 * high-ceiling method vs the per-letter backoff. Trains on CMUdict (public domain, no espeak):
 *   1. EM-align letters→ARPABET (1 letter → 0..2 phones).
 *   2. Turn each word into a sequence of JOINT tokens  g:p  (grapheme-chunk : phone-chunk).
 *   3. Train an n-gram LM (order N) over the joint-token sequences, with stupid-backoff smoothing.
 *   4. Decode a new word with a beam over graphemic segmentations, scoring joint-token n-grams.
 * Predicts stress-bearing ARPABET → arpabetToIpa → canonical. Word-acc vs CMUdict = OOV canonical quality.
 *   npx tsx tools/english/en_g2p_ngram.ts [--order N] [--beam K] [--iters M] [--phonemic] [--errors]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { makeArpabetToIpa } from "../../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../../src/languages/english/manifest.ts";

// ⚠ THE CONVERTER IS BUILT FROM THE SAME MANIFEST THE RUNTIME USES, so a model scored here is scored in
// exactly the convention `english.ts` will render it in. Do not inline a private ARPABET table.
const arpabetToIpa = makeArpabetToIpa(MANIFEST.arpabet);

// External data roots, per tools/README — nothing here hardcodes a machine layout.
// CMUDICT: the CMUdict `cmudict.dict` file (public domain). EN_FREQ: an English frequency wordlist,
// one word per line, used only to score the model on COMMON words.
const CMUDICT = process.env["CMUDICT"] ?? "";
const EN_FREQ = process.env["EN_FREQ"] ?? "";
if (CMUDICT === "") throw new Error("set CMUDICT to a cmudict.dict path");

const ARPA_BASE = new Set([
    "AA",
    "AE",
    "AH",
    "AO",
    "AW",
    "AY",
    "EH",
    "ER",
    "EY",
    "IH",
    "IY",
    "OW",
    "OY",
    "UH",
    "UW",
    "B",
    "CH",
    "D",
    "DH",
    "F",
    "G",
    "HH",
    "JH",
    "K",
    "L",
    "M",
    "N",
    "NG",
    "P",
    "R",
    "S",
    "SH",
    "T",
    "TH",
    "V",
    "W",
    "Y",
    "Z",
    "ZH",
]);
const argIdx = (f: string): number => process.argv.indexOf(f);
const ORDER = argIdx("--order") >= 0 ? Number(process.argv[argIdx("--order") + 1]) : 5;
const BEAM = argIdx("--beam") >= 0 ? Number(process.argv[argIdx("--beam") + 1]) : 12;
const EM_ITERS = argIdx("--iters") >= 0 ? Number(process.argv[argIdx("--iters") + 1]) : 6;
const PHONEMIC = process.argv.includes("--phonemic"); // strip stress from targets (measure segment ceiling)

function load(): [string, string[]][] {
    const out: [string, string[]][] = [];
    for (const l of readFileSync(CMUDICT, "utf8").split("\n")) {
        const sp = l.indexOf(" ");
        if (sp < 0) continue;
        const key = l.slice(0, sp);
        if (/\(\d\)$/.test(key)) continue;
        const w = key.toLowerCase();
        if (!/^[a-z]+$/.test(w) || w.length > 18) continue;
        let phones = l
            .slice(sp + 1)
            .split("#")[0]!
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (!phones.every((p) => ARPA_BASE.has(p.replace(/[0-2]$/, "")))) continue;
        if (PHONEMIC) phones = phones.map((p) => p.replace(/[0-2]$/, ""));
        out.push([w, phones]);
    }
    return out;
}

/** EM Viterbi alignment: 1 letter → 0..2 phones. Returns [graphemeLetter, phoneChunk][]. */
function alignWord(word: string, phones: string[], P: Map<string, Map<string, number>>): [string, string][] | null {
    const n = word.length,
        m = phones.length,
        NEG = -1e9;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(NEG));
    const bk = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    dp[0]![0] = 0;
    const lp = (letter: string, chunk: string): number => {
        const m2 = P.get(letter);
        const c = m2?.get(chunk) ?? 0;
        return Math.log((c + 1e-3) / ((m2 ? [...m2.values()].reduce((a, b) => a + b, 0) : 0) + 1e-2));
    };
    for (let i = 0; i < n; i++)
        for (let j = 0; j <= m; j++) {
            if (dp[i]![j] === NEG) continue;
            for (let k = 0; k <= 2 && j + k <= m; k++) {
                const s = dp[i]![j]! + lp(word[i]!, phones.slice(j, j + k).join(" "));
                if (s > dp[i + 1]![j + k]!) {
                    dp[i + 1]![j + k] = s;
                    bk[i + 1]![j + k] = k;
                }
            }
        }
    if (dp[n]![m] === NEG) return null;
    const pairs: [string, string][] = [];
    let i = n,
        j = m;
    while (i > 0) {
        const k = bk[i]![j]!;
        pairs.push([word[i - 1]!, phones.slice(j - k, j).join(" ")]);
        i--;
        j -= k;
    }
    return pairs.reverse();
}

const data = load();
process.stderr.write(`loaded ${data.length} words\n`);

// EM alignment.
let P = new Map<string, Map<string, number>>();
const bumpP = (Pn: Map<string, Map<string, number>>, letter: string, chunk: string, w = 1): void => {
    if (!Pn.has(letter)) Pn.set(letter, new Map());
    const m = Pn.get(letter)!;
    m.set(chunk, (m.get(chunk) ?? 0) + w);
};
for (const [w, ph] of data)
    for (const c of w)
        for (let k = 0; k <= 2 && k <= ph.length; k++)
            for (let j = 0; j + k <= ph.length; j++)
                bumpP(P, c, ph.slice(j, j + k).join(" "), 1 / (w.length * (ph.length + 1)));
for (let it = 0; it < EM_ITERS; it++) {
    const Pn = new Map<string, Map<string, number>>();
    for (const [w, ph] of data) {
        const a = alignWord(w, ph, P);
        if (!a) continue;
        for (const [c, chunk] of a) bumpP(Pn, c, chunk);
    }
    P = Pn;
    process.stderr.write(`EM iter ${it + 1}\n`);
}

// Per-grapheme legal phone-chunks (for decoding): what phone-chunks each 1- or 2-letter grapheme can emit.
// We restrict decoding to graphemes of length 1 (aligned model is 1-letter), so the graphemic segmentation
// is trivial (every letter is its own grapheme); the LM carries the context. Joint token = `${letter}:${chunk}`.
const graphemeChunks = new Map<string, Set<string>>(); // letter → set of phone-chunks seen
// N-gram LM over joint tokens.
const ngram: Map<string, Map<string, number>>[] = Array.from({ length: ORDER }, () => new Map());
const ctxTotal: Map<string, number>[] = Array.from({ length: ORDER }, () => new Map());
const START = "^";
const bumpN = (order: number, ctx: string, tok: string): void => {
    let m = ngram[order]!.get(ctx);
    if (!m) {
        m = new Map();
        ngram[order]!.set(ctx, m);
    }
    m.set(tok, (m.get(tok) ?? 0) + 1);
    ctxTotal[order]!.set(ctx, (ctxTotal[order]!.get(ctx) ?? 0) + 1);
};

const test: [string, string[]][] = [];
for (let di = 0; di < data.length; di++) {
    const [w, ph] = data[di]!;
    if (di % 10 === 3) {
        test.push([w, ph]);
        continue;
    }
    const a = alignWord(w, ph, P);
    if (!a) continue;
    const toks = a.map(([c, chunk]) => `${c}:${chunk}`);
    for (const [c, chunk] of a) {
        if (!graphemeChunks.has(c)) graphemeChunks.set(c, new Set());
        graphemeChunks.get(c)!.add(chunk);
    }
    const hist: string[] = [START, START, START, START];
    for (const tok of toks) {
        for (let o = 0; o < ORDER; o++) {
            const ctx = o === 0 ? "" : hist.slice(hist.length - o).join(" ");
            bumpN(o, ctx, tok);
        }
        hist.push(tok);
    }
}

// Stupid-backoff score: log P(tok|ctx) interpolating high→low order with 0.4^k backoff weight.
// Also returns the ORDER the token was found at (higher = more context = more confident) so the decoder
// can tell a CONFIDENT silent vowel (seen in a high-order context, e.g. magic-e) from a GUESS (only the
// low-order prior fired, i.e. the model is extrapolating on a novel word).
const ALPHA = 0.4;
function scoreTokAt(hist: string[], tok: string): [number, number] {
    for (let o = ORDER - 1; o >= 0; o--) {
        const ctx = o === 0 ? "" : hist.slice(hist.length - o).join(" ");
        const m = ngram[o]!.get(ctx);
        const tot = ctxTotal[o]!.get(ctx);
        if (m && tot) {
            const c = m.get(tok);
            if (c) return [Math.log(c / tot) + (ORDER - 1 - o) * Math.log(ALPHA), o];
        }
    }
    return [Math.log(1e-7), -1]; // unseen token
}

// Penalty (log-prob) for emitting the SILENT chunk on a vowel letter ONLY WHEN the model is guessing —
// i.e. the empty emission was found only at a low backoff order (< EVP_ORDER), meaning the high-order
// context is unseen and the model is extrapolating on a novel word. A confidently-silent vowel (magic-e,
// seen in a high-order context) is NOT penalized, so real silent vowels are preserved. Exempt word-final
// 'e'. Tunable via --evp (penalty) / --evpo (order threshold).
const EVP = argIdx("--evp") >= 0 ? Number(process.argv[argIdx("--evp") + 1]) : 5;
const EVP_ORDER = argIdx("--evpo") >= 0 ? Number(process.argv[argIdx("--evpo") + 1]) : 3;
const VOWEL_LETTER = new Set(["a", "e", "i", "o", "u"]);
interface Hyp {
    toks: string[];
    hist: string[];
    phones: string[];
    score: number;
}
function decode(w: string): string[] {
    let beam: Hyp[] = [{ toks: [], hist: [START, START, START, START], phones: [], score: 0 }];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const chunks = graphemeChunks.get(c) ?? new Set([""]);
        const emptyPenalized = VOWEL_LETTER.has(c) && !(c === "e" && i === w.length - 1);
        const sibLetter = "sxzc".includes(c); // only these letters legitimately emit a trailing S/Z
        const next: Hyp[] = [];
        for (const h of beam) {
            for (const chunk of chunks) {
                // Guard a spurious phantom sibilant (brexit→brexits): a single non-sibilant letter (t/d/n…) must
                // not emit a chunk ending in S/Z — that's a training-alignment artifact, not a real mapping.
                if (!sibLetter && chunk) {
                    const last = chunk.split(" ").pop();
                    if (last === "S" || last === "Z") continue;
                }
                const tok = `${c}:${chunk}`;
                const [lp, order] = scoreTokAt(h.hist, tok);
                let s = h.score + lp;
                if (chunk === "" && emptyPenalized && order < EVP_ORDER) s -= EVP; // penalize only GUESSED silence
                next.push({
                    toks: [...h.toks, tok],
                    hist: [...h.hist, tok],
                    phones: chunk ? [...h.phones, ...chunk.split(" ")] : h.phones,
                    score: s,
                });
            }
        }
        next.sort((a, b) => b.score - a.score);
        beam = next.slice(0, BEAM);
    }
    return beam[0]!.phones;
}

// ---- Morphology: OOV word = known (in-dict) stem + a stress-neutral inflectional suffix. Strip the
// suffix, use the stem's EXACT training-dict pronunciation, append the allomorph (voicing-agreeing). This
// is espeak's SUFX approach and handles the bulk of real OOV (inflections/derivations of known words).
const MORPH = process.argv.includes("--morph");
const trainDict = new Map<string, string[]>();
for (let di = 0; di < data.length; di++) {
    if (di % 10 === 3) continue;
    const [w, ph] = data[di]!;
    if (!trainDict.has(w)) trainDict.set(w, ph);
}
// Compound-PIECE source = the FULL dict (runtime has all 122k CMUdict). Using it here removes the
// train/test-split artifact (doomscroll's `scroll` landing in the held-out tenth); pieces are OTHER words,
// never the held-out word itself, so it's realistic, not a leak.
const fullDict = new Map<string, string[]>();
for (let di = 0; di < data.length; di++) {
    const [w, ph] = data[di]!;
    if (!fullDict.has(w)) fullDict.set(w, ph);
}
const base = (p: string): string => p.replace(/[0-2]$/, "");
const VOICELESS = new Set(["P", "T", "K", "F", "TH", "S", "SH", "CH", "HH"]);
const SIBILANT = new Set(["S", "Z", "SH", "ZH", "CH", "JH"]);
const allomorphS = (stem: string[]): string[] => {
    const f = base(stem[stem.length - 1] ?? "");
    return SIBILANT.has(f) ? ["IH0", "Z"] : VOICELESS.has(f) ? ["S"] : ["Z"];
};
const allomorphED = (stem: string[]): string[] => {
    const f = base(stem[stem.length - 1] ?? "");
    return f === "T" || f === "D" ? ["IH0", "D"] : VOICELESS.has(f) ? ["T"] : ["D"];
};
// [suffix-spelling, stem-candidate generator(word→stems), allomorph(stemPhones)→phones].
const SUFFIXES: [string, (w: string) => string[], (s: string[]) => string[]][] = [
    ["ies", (w) => [w.slice(0, -3) + "y"], () => ["IY0", "Z"]], // flies→fly (+z)
    ["ied", (w) => [w.slice(0, -3) + "y"], () => ["D"]], // tried→try
    ["sses", (w) => [w.slice(0, -2)], (s) => allomorphS(s)], // classes→class
    ["ing", (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4)], () => ["IH0", "NG"]], // run(n)/hop(e)
    ["ings", (w) => [w.slice(0, -4), w.slice(0, -4) + "e"], () => ["IH0", "NG", "Z"]],
    ["edly", (w) => [w.slice(0, -4), w.slice(0, -4) + "e"], () => ["IH0", "D", "L", "IY0"]],
    ["ness", (w) => [w.slice(0, -4), w.slice(0, -4).replace(/i$/, "y")], () => ["N", "AH0", "S"]],
    ["less", (w) => [w.slice(0, -4)], () => ["L", "AH0", "S"]],
    ["ment", (w) => [w.slice(0, -4)], () => ["M", "AH0", "N", "T"]],
    ["ful", (w) => [w.slice(0, -3)], () => ["F", "AH0", "L"]],
    ["est", (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -3).replace(/i$/, "y")], () => ["IH0", "S", "T"]],
    ["ers", (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4)], () => ["ER0", "Z"]],
    [
        "er",
        (w) => [w.slice(0, -2), w.slice(0, -2) + "e", w.slice(0, -3), w.slice(0, -2).replace(/i$/, "y")],
        () => ["ER0"],
    ],
    ["est", (w) => [w.slice(0, -3)], () => ["IH0", "S", "T"]],
    ["ly", (w) => [w.slice(0, -2), w.slice(0, -2).replace(/i$/, "y"), w.slice(0, -2) + "le"], () => ["L", "IY0"]],
    ["ed", (w) => [w.slice(0, -2), w.slice(0, -1), w.slice(0, -3)], (s) => allomorphED(s)], // hoped→hope, batted→bat
    ["es", (w) => [w.slice(0, -2), w.slice(0, -1)], (s) => allomorphS(s)],
    ["s", (w) => [w.slice(0, -1)], (s) => allomorphS(s)],
];
// Compound splitting: many OOV words are COMPOUNDS of in-dict words (doomscroll=doom+scroll,
// vibecoding=vibe+coding, cryptobro=crypto+bro). Segment into ≥2 dict pieces (each ≥ MINPART chars),
// preferring fewer/longer pieces, and compose their EXACT dict pronunciations with English compound stress
// (first element primary, later elements demoted to secondary). A trailing inflectional suffix is allowed
// as the last piece (adult+ing). Returns composed stress-bearing ARPABET, or null if no clean split.
const MINPART = 3;
// Frequency gate: a compound piece must be a COMMON word (top FREQ_TOP of the frequency list), so a rare
// dict-substring coincidence (morrison→morris+on) can't false-split. This is what separates a genuine
// modern compound (common+common) from an accidental substring match.
// Runtime-appropriate default: the dict catches non-compound real words BEFORE the splitter is reached, so
// the offline false-positive concern (abstract→abs+tract) doesn't apply at runtime — we can gate loosely.
const FREQ_TOP = argIdx("--freqtop") >= 0 ? Number(process.argv[argIdx("--freqtop") + 1]) : 40000;
const COMMON = new Set<string>();
try {
    const freq = readFileSync(EN_FREQ, "utf8").split("\n");
    for (let i = 0; i < Math.min(FREQ_TOP, freq.length); i++) {
        const t = freq[i]!.trim().toLowerCase();
        if (t) COMMON.add(t);
    }
} catch {
    /* no freq list → gate disabled */
}
// Function words that must NEVER be compound pieces even if frequent (the+rapist, a+tone, one+…).
const STOP_PIECE = new Set([
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "any",
    "can",
    "her",
    "was",
    "one",
    "our",
    "out",
    "his",
    "has",
    "had",
    "him",
    "how",
    "man",
    "new",
    "now",
    "old",
    "see",
    "two",
    "way",
    "who",
    "boy",
    "did",
    "its",
    "let",
    "put",
    "say",
    "she",
    "too",
    "use",
    "ate",
    "eat",
    "ion",
    "per",
]);
const stressDown = (ph: string[]): string[] => ph.map((p) => p.replace(/1$/, "2")); // primary→secondary
function compoundSplit(w: string): string[] | null {
    const n = w.length;
    // best[i] = split of w[0..i]. Objective (lexicographic): maximize the MINIMUM piece length (so
    // situationship → situation+ship, NOT situations+hip whose spurious plural-z leaks into the seam), then
    // maximize sum of piece-length² (favor few long pieces). Min-piece-length kills tiny junk fragments.
    const best: ({ parts: string[][]; nparts: number; minLen: number; score: number } | null)[] = new Array(n + 1).fill(
        null,
    );
    best[0] = { parts: [], nparts: 0, minLen: Infinity, score: 0 };
    for (let i = 0; i < n; i++) {
        if (!best[i]) continue;
        for (let j = i + MINPART; j <= n; j++) {
            const piece = w.slice(i, j);
            if (STOP_PIECE.has(piece)) continue;
            if (COMMON.size > 0 && !COMMON.has(piece) && !(j === n && j - i >= 5)) continue; // freq gate (final morph piece exempt)
            let phones = fullDict.get(piece) ?? null;
            // allow the FINAL piece to be a dict-stem + inflectional suffix (doom+scrolling→doom+scroll+ing) —
            // but only for a substantial piece (≥5 chars) so tiny fragments (zoom+"ies") don't mis-decompose.
            if (!phones && j === n && j - i >= 5) {
                const mp = morphDecode(piece);
                if (mp) phones = mp;
            }
            if (!phones) continue;
            const cand = {
                parts: [...best[i]!.parts, phones],
                nparts: best[i]!.nparts + 1,
                minLen: Math.min(best[i]!.minLen, j - i),
                score: best[i]!.score + (j - i) * (j - i),
            };
            const cur = best[j];
            if (!cur || cand.minLen > cur.minLen || (cand.minLen === cur.minLen && cand.score > cur.score))
                best[j] = cand;
        }
    }
    const full = best[n];
    if (!full || full.nparts < 2) return null; // need a genuine ≥2-piece compound
    return full.parts.flatMap((p, idx) => (idx === 0 ? p : stressDown(p)));
}

function morphDecode(w: string): string[] | null {
    for (const [suf, stems, allo] of SUFFIXES) {
        if (!w.endsWith(suf) || w.length <= suf.length + 1) continue;
        for (const stem of stems(w)) {
            if (stem.length < 2) continue;
            const sp = fullDict.get(stem);
            if (!sp) continue;
            return [...sp, ...allo(sp)];
        }
    }
    return null;
}

const COMP = process.argv.includes("--comp");
// Collapse adjacent identical phones — CMUdict has no geminates, so a doubled phone is always spurious
// (bus+sin seam → bʌssɪn → bʌsɪn; any compound-seam or n-gram accidental double). Lossless vs CMUdict.
function collapseGeminates(ph: string[]): string[] {
    const out: string[] = [];
    for (const p of ph) if (out[out.length - 1] !== p) out.push(p);
    return out;
}
function enforceSinglePrimary(ph: string[]): string[] {
    let seen = false;
    return ph.map((p) => {
        if (!/1$/.test(p)) return p;
        if (seen) return p.replace(/1$/, "2");
        seen = true;
        return p;
    });
}
const clean = (ph: string[]): string[] => enforceSinglePrimary(collapseGeminates(ph));
// Unified OOV decomposition: try COMPOUND split (dict pieces) first, then suffix MORPHOLOGY, then the
// n-gram G2P. Returns [phones, source-tag].
function decompose(w: string): [string[], string] {
    if (COMP) {
        const c = compoundSplit(w);
        if (c) return [clean(c), "C"];
    }
    if (MORPH) {
        const m = morphDecode(w);
        if (m) return [clean(m), "M"];
    }
    return [clean(decode(w)), "N"];
}

if (argIdx("--emit") >= 0) {
    // Ship the three runtime artifacts for englishG2p.ts into <dir> (default data/en):
    //   g2p-model.json  — params + graphemeChunks + per-context { t: full total, c: pruned top-K [chunk,count] }
    //   g2p-dict.tsv    — word <TAB> ARPABET (compound pieces / morph stems)
    //   g2p-common.txt  — the common-word freq gate for compound pieces
    const { writeFileSync } = await import("node:fs");
    const { join: pjoin } = await import("node:path");
    const minC = argIdx("--minc") >= 0 ? Number(process.argv[argIdx("--minc") + 1]) : 3;
    // Default output is the English engine's own directory — "read from an external data root, write into
    // src/", the convention tools/README states.
    const dir =
        process.argv[argIdx("--emit") + 1] && !process.argv[argIdx("--emit") + 1]!.startsWith("--")
            ? process.argv[argIdx("--emit") + 1]!
            : pjoin(process.cwd(), "src", "languages", "english");
    const model: Record<string, { t: number; c: [string, number][] }> = {};
    for (let o = 0; o < ORDER; o++)
        for (const [ctx, m] of ngram[o]!) {
            const kept = [...m.entries()]
                .filter(([, c]) => c >= minC)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);
            if (kept.length) model[`${o}|${ctx}`] = { t: ctxTotal[o]!.get(ctx)!, c: kept };
        }
    const gc: Record<string, string[]> = {};
    for (const [c, s] of graphemeChunks) gc[c] = [...s];
    const json = JSON.stringify({
        order: ORDER,
        alpha: ALPHA,
        evp: EVP,
        evpOrder: EVP_ORDER,
        minCount: minC,
        graphemeChunks: gc,
        ngram: model,
    });
    writeFileSync(pjoin(dir, "g2p-model.json"), json);
    let dictTsv = "# Generated by en_g2p_ngram.ts --emit. word<TAB>ARPABET; CMUdict (public domain).\n";
    for (const [w, ph] of fullDict) dictTsv += `${w}\t${ph.join(" ")}\n`;
    writeFileSync(pjoin(dir, "g2p-dict.tsv"), dictTsv);
    writeFileSync(pjoin(dir, "g2p-common.txt"), [...COMMON].join("\n") + "\n");
    console.log(
        `emitted → ${dir}: g2p-model.json (${Object.keys(model).length} ctx, ${(Buffer.byteLength(json) / 1e6).toFixed(1)}MB), g2p-dict.tsv (${fullDict.size} words), g2p-common.txt (${COMMON.size})`,
    );
    process.exit(0);
}

if (argIdx("--words") >= 0) {
    const words = process.argv[argIdx("--words") + 1]!.split(",");
    for (const w of words) {
        const [ph, tag] = decompose(w);
        console.log(`${w}\t[${tag}] ${arpabetToIpa(ph, tag === "N" ? w : "")}`);
    }
    process.exit(0);
}

if (process.argv.includes("--analyze")) {
    // Error roadmap for authoring: over held-out errors, tally (gold-phone → pred-phone) substitutions and,
    // separately, whole-word STRESS-only vs SEGMENT errors, so we know where authoring effort pays off.
    const subs = new Map<string, number>();
    let stressOnly = 0,
        segErr = 0,
        total = 0,
        wrong = 0;
    for (const [w, ph] of test) {
        total++;
        const pred = decode(w);
        if (pred.join(" ") === ph.join(" ")) continue;
        wrong++;
        // stress-only? compare with stress stripped.
        const bare = (a: string[]): string => a.map((p) => p.replace(/[0-2]$/, "")).join(" ");
        if (bare(pred) === bare(ph)) stressOnly++;
        else segErr++;
        // phone substitutions (align by index up to min length)
        for (let i = 0; i < Math.min(pred.length, ph.length); i++)
            if (pred[i] !== ph[i]) subs.set(`${ph[i]}→${pred[i]}`, (subs.get(`${ph[i]}→${pred[i]}`) ?? 0) + 1);
    }
    console.log(
        `errors ${wrong}/${total}: STRESS-only ${stressOnly} (${((100 * stressOnly) / wrong).toFixed(0)}%), SEGMENT ${segErr} (${((100 * segErr) / wrong).toFixed(0)}%)`,
    );
    console.log("top phone substitutions (gold→pred):");
    for (const [k, v] of [...subs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30))
        console.log(`  ${k.padEnd(12)} ${v}`);
    process.exit(0);
}

let wOk = 0;
const errs: string[] = [];
// Per-source breakdown: for each decomposition source (C/M/N), fired count, its accuracy, and what the
// n-gram-alone would have scored on the same words (to prove C/M add value, not just fire).
const srcN: Record<string, number> = { C: 0, M: 0, N: 0 };
const srcOk: Record<string, number> = { C: 0, M: 0, N: 0 };
const srcNgramOk: Record<string, number> = { C: 0, M: 0, N: 0 };
for (const [w, ph] of test) {
    const [pred, tag] = decompose(w);
    srcN[tag]!++;
    const ok = pred.join(" ") === ph.join(" ");
    if (ok) {
        wOk++;
        srcOk[tag]!++;
    }
    if (tag !== "N" && decode(w).join(" ") === ph.join(" ")) srcNgramOk[tag]!++;
    if (!ok && errs.length < 30)
        errs.push(`  ${w.padEnd(14)} [${tag}] g2p=${arpabetToIpa(pred).padEnd(22)} gold=${arpabetToIpa(ph)}`);
}
console.log(
    `JOINT N-GRAM order=${ORDER} beam=${BEAM}${PHONEMIC ? " PHONEMIC" : " stress-bearing"}${COMP ? " +COMP" : ""}${MORPH ? " +MORPH" : ""} held-out (${test.length}): WORD-acc ${((100 * wOk) / test.length).toFixed(1)}%`,
);
for (const t of ["C", "M"])
    if (srcN[t]!)
        console.log(
            `  [${t}] fired ${srcN[t]}: ${((100 * srcOk[t]!) / srcN[t]!).toFixed(1)}% vs n-gram-alone ${((100 * srcNgramOk[t]!) / srcN[t]!).toFixed(1)}% on the same words`,
        );
if (process.argv.includes("--errors")) console.log(errs.join("\n"));
