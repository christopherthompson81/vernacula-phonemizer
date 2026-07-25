/**
 * English-native OOV G2P (English divestment, Phase 2). The cleanroom replacement for espeak's en_rules on
 * words NOT in the CMUdict pronunciation lexicon. Compositional-first (real OOV is ~all compounds/
 * inflections of known words), with a joint-sequence n-gram fallback for the non-compositional tail:
 *
 *   compound-split (dict pieces + compound stress) → suffix morphology → joint n-gram beam decode
 *
 * All paths emit stress-bearing ARPABET; {@link arpabetToIpa} renders the SAME canonical convention as the
 * dict, so a sentence mixing dict + G2P words has no seam. Trained cleanroom on CMUdict (public domain, no
 * espeak); the model is built by tools/compile-data/build-en-g2p-ngram.ts (--emit). Pure function of its
 * injected {model, dict, common, arpabetToIpa} — no filesystem/globals — so it ports trivially to C#.
 */

/** Serialized model (from build-en-g2p-ngram.ts --emit): joint n-gram over grapheme:phone tokens. */
export interface EnglishG2pModel {
    order: number;
    alpha: number;
    evp: number;
    evpOrder: number;
    graphemeChunks: Record<string, string[]>;
    /** key `${order}|${ctx}` → { t: full context total, c: pruned top-K [chunk, count] }. */
    ngram: Record<string, { t: number; c: [string, number][] }>;
}

const START = "^";
const BEAM = 12;
const MINPART = 3;
// The ARPABET phonetic-class sets (VOWEL/VOICELESS/SIBILANT), orthographic vowel letters, and the
// compound-splitter's stop-word list are INJECTED (from english.jsonc via createEnglishG2p's `classes`) — this
// file loads no data, so it still ports trivially to C#. See the G2pClasses interface below.
const dropStress = (p: string): string => p.replace(/[0-2]$/, "");
const stressDown = (ph: string[]): string[] =>
    ph.map((p) => p.replace(/1$/, "2"));

/** Collapse a doubled CONSONANT (bus+sin seam → bʌssɪn → bʌsɪn; CMUdict has no consonant geminates). Does NOT
 *  collapse identical adjacent VOWELS — that would delete a nucleus/syllable (AA1 AA1 → AA1). Exported so the neural
 *  OOV reader (englishTagger.ts) finishes its ARPABET the SAME way as the n-gram path. */
export function collapseGeminates(ph: string[], vowels: ReadonlySet<string>): string[] {
    const out: string[] = [];
    for (const p of ph)
        if (out[out.length - 1] !== p || vowels.has(dropStress(p))) out.push(p);
    return out;
}

/** A word has exactly ONE primary stress. A per-position predictor (n-gram OR the BiLSTM tagger) can emit several
 *  `1`s (keep the FIRST, demote the rest to `2`) OR — for a short/odd word — ZERO `1`s (then PROMOTE the first vowel
 *  to primary so every content word carries a tonic). Exported so englishTagger.ts shares the exact stress invariant. */
export function enforceSinglePrimary(ph: string[], vowels: ReadonlySet<string>): string[] {
    let seen = false;
    const out = ph.map((p) => {
        if (!/1$/.test(p)) return p;
        if (seen) return p.replace(/1$/, "2");
        seen = true;
        return p;
    });
    if (!seen) {
        const vi = out.findIndex((p) => vowels.has(dropStress(p)));
        if (vi >= 0) out[vi] = out[vi]!.replace(/[0-2]$/, "1");
    }
    return out;
}

/** ARPABET phonetic-class sets injected into the OOV G2P (from english.jsonc's `g2pClasses`). */
export interface G2pClasses {
    vowelLetters: string[];
    vowels: string[];
    voiceless: string[];
    sibilants: string[];
    stopPieces: string[];
}

export interface EnglishG2p {
    /** OOV word (lowercase letters) → canonical IPA. */
    g2p(word: string): string;
    /** Is this a known CMUdict word? A word that is in CMUdict but NOT in the pronunciation lexicon is an
     *  excluded HOMOGRAPH (read/use/close) — the router keeps espeak's POS-gated output for it rather than
     *  G2P'ing it. Only genuinely-unknown words (!knownWord) should be routed to {@link g2p}. */
    knownWord(word: string): boolean;
    /** Diagnostic: the ARPABET decomposition + which path produced it (C/M/N). */
    decompose(word: string): { phones: string[]; source: "C" | "M" | "N" };
}

/**
 * Build the engine from a model + the CMUdict ARPABET dict (word → phones, for compound pieces / morph
 * stems) + the `common`-word set (frequency gate for compound pieces). Injected, not loaded, so this file
 * is pure and mirror-friendly.
 */
export function createEnglishG2p(
    model: EnglishG2pModel,
    dict: ReadonlyMap<string, string[]>,
    common: ReadonlySet<string>,
    arpabetToIpa: (phones: string[], word?: string) => string,
    classes: G2pClasses,
): EnglishG2p {
    const { order, alpha, evp, evpOrder } = model;
    const gchunks = new Map<string, string[]>(
        Object.entries(model.graphemeChunks),
    );
    const VOWEL_LETTER = new Set(classes.vowelLetters);
    const VOWEL = new Set(classes.vowels);
    const VOICELESS = new Set(classes.voiceless);
    const SIBILANT = new Set(classes.sibilants);
    const STOP_PIECE = new Set(classes.stopPieces);


    // --- joint n-gram: stupid-backoff score + order matched (for the guessed-silence penalty) ---
    function scoreTokAt(hist: string[], tok: string): [number, number] {
        for (let o = order - 1; o >= 0; o--) {
            const ctx = o === 0 ? "" : hist.slice(hist.length - o).join(" ");
            const e = model.ngram[`${o}|${ctx}`];
            // e.c stores the JOINT tokens `${letter}:${chunk}` (as trained), so match the full token.
            if (e) {
                const hit = e.c.find(([t]) => t === tok);
                if (hit)
                    return [
                        Math.log(hit[1] / e.t) +
                            (order - 1 - o) * Math.log(alpha),
                        o,
                    ];
            }
        }
        return [Math.log(1e-7), -1];
    }
    function ngramDecode(w: string): string[] {
        let beam = [
            {
                hist: [START, START, START, START],
                phones: [] as string[],
                score: 0,
            },
        ];
        for (let i = 0; i < w.length; i++) {
            const c = w[i]!;
            const raw = gchunks.get(c) ?? [""];
            const emptyPenalized =
                VOWEL_LETTER.has(c) && !(c === "e" && i === w.length - 1);
            const sibLetter = "sxzc".includes(c);
            // Phantom-sibilant filter, applied once per letter — a non-sibilant letter can't emit a chunk ending
            // in S/Z. Fall back to the unfiltered chunks if the filter would leave nothing (so the beam can never
            // empty and `beam[0]` can't be undefined).
            const filtered = sibLetter
                ? raw
                : raw.filter((ch) => {
                      if (!ch) return true;
                      const last = ch.split(" ").pop();
                      return last !== "S" && last !== "Z";
                  });
            const chunks = filtered.length > 0 ? filtered : raw;
            const next: typeof beam = [];
            for (const h of beam) {
                for (const chunk of chunks) {
                    const [lp, ord] = scoreTokAt(h.hist, `${c}:${chunk}`);
                    let s = h.score + lp;
                    if (chunk === "" && emptyPenalized && ord < evpOrder)
                        s -= evp;
                    next.push({
                        hist: [...h.hist, `${c}:${chunk}`],
                        phones: chunk
                            ? [...h.phones, ...chunk.split(" ")]
                            : h.phones,
                        score: s,
                    });
                }
            }
            next.sort((a, b) => b.score - a.score);
            beam = next.slice(0, BEAM);
        }
        return beam[0]!.phones;
    }

    // --- morphology: known-stem + inflectional suffix → dict stem + voicing-agreeing allomorph ---
    const allomorphS = (stem: string[]): string[] => {
        const f = dropStress(stem[stem.length - 1] ?? "");
        return SIBILANT.has(f)
            ? ["IH0", "Z"]
            : VOICELESS.has(f)
              ? ["S"]
              : ["Z"];
    };
    const allomorphED = (stem: string[]): string[] => {
        const f = dropStress(stem[stem.length - 1] ?? "");
        return f === "T" || f === "D"
            ? ["IH0", "D"]
            : VOICELESS.has(f)
              ? ["T"]
              : ["D"];
    };
    const SUFFIXES: [
        string,
        (w: string) => string[],
        (s: string[]) => string[],
    ][] = [
        ["ies", (w) => [w.slice(0, -3) + "y"], () => ["IY0", "Z"]],
        ["ied", (w) => [w.slice(0, -3) + "y"], () => ["D"]],
        ["sses", (w) => [w.slice(0, -2)], (s) => allomorphS(s)],
        [
            "ing",
            (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4)],
            () => ["IH0", "NG"],
        ],
        [
            "ings",
            (w) => [w.slice(0, -4), w.slice(0, -4) + "e"],
            () => ["IH0", "NG", "Z"],
        ],
        [
            "edly",
            (w) => [w.slice(0, -4), w.slice(0, -4) + "e"],
            () => ["IH0", "D", "L", "IY0"],
        ],
        [
            "ness",
            (w) => [w.slice(0, -4), w.slice(0, -4).replace(/i$/, "y")],
            () => ["N", "AH0", "S"],
        ],
        ["less", (w) => [w.slice(0, -4)], () => ["L", "AH0", "S"]],
        ["ment", (w) => [w.slice(0, -4)], () => ["M", "AH0", "N", "T"]],
        ["ful", (w) => [w.slice(0, -3)], () => ["F", "AH0", "L"]],
        [
            "est",
            (w) => [
                w.slice(0, -3),
                w.slice(0, -3) + "e",
                w.slice(0, -3).replace(/i$/, "y"),
            ],
            () => ["IH0", "S", "T"],
        ],
        [
            "ers",
            (w) => [w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4)],
            () => ["ER0", "Z"],
        ],
        [
            "er",
            (w) => [
                w.slice(0, -2),
                w.slice(0, -2) + "e",
                w.slice(0, -3),
                w.slice(0, -2).replace(/i$/, "y"),
            ],
            () => ["ER0"],
        ],
        [
            "ly",
            (w) => [
                w.slice(0, -2),
                w.slice(0, -2).replace(/i$/, "y"),
                w.slice(0, -2) + "le",
            ],
            () => ["L", "IY0"],
        ],
        [
            "ed",
            (w) => [w.slice(0, -2), w.slice(0, -1), w.slice(0, -3)],
            (s) => allomorphED(s),
        ],
        ["es", (w) => [w.slice(0, -2), w.slice(0, -1)], (s) => allomorphS(s)],
        ["s", (w) => [w.slice(0, -1)], (s) => allomorphS(s)],
    ];
    function morphDecode(w: string): string[] | null {
        for (const [suf, stems, allo] of SUFFIXES) {
            if (!w.endsWith(suf) || w.length <= suf.length + 1) continue;
            for (const stem of stems(w)) {
                if (stem.length < 2) continue;
                const sp = dict.get(stem);
                if (!sp) continue;
                return [...sp, ...allo(sp)];
            }
        }
        return null;
    }

    // --- compound split: DP into ≥2 dict pieces, maximize min-piece-length then sum-len²; compound stress ---
    function compoundSplit(w: string): string[] | null {
        const n = w.length;
        const best: ({
            parts: string[][];
            nparts: number;
            minLen: number;
            score: number;
        } | null)[] = new Array(n + 1).fill(null);
        best[0] = { parts: [], nparts: 0, minLen: Infinity, score: 0 };
        for (let i = 0; i < n; i++) {
            if (!best[i]) continue;
            for (let j = i + MINPART; j <= n; j++) {
                const piece = w.slice(i, j);
                if (STOP_PIECE.has(piece)) continue;
                if (
                    common.size > 0 &&
                    !common.has(piece) &&
                    !(j === n && j - i >= 5)
                )
                    continue;
                let phones = dict.get(piece) ?? null;
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
                if (
                    !cur ||
                    cand.minLen > cur.minLen ||
                    (cand.minLen === cur.minLen && cand.score > cur.score)
                )
                    best[j] = cand;
            }
        }
        const full = best[n];
        if (!full || full.nparts < 2) return null;
        return full.parts.flatMap((p, idx) => (idx === 0 ? p : stressDown(p)));
    }

    function decomposeInner(w: string): {
        phones: string[];
        source: "C" | "M" | "N";
    } {
        const c = compoundSplit(w);
        if (c)
            return {
                phones: enforceSinglePrimary(collapseGeminates(c, VOWEL), VOWEL),
                source: "C",
            };
        const m = morphDecode(w);
        if (m)
            return {
                phones: enforceSinglePrimary(collapseGeminates(m, VOWEL), VOWEL),
                source: "M",
            };
        return {
            phones: enforceSinglePrimary(collapseGeminates(ngramDecode(w), VOWEL), VOWEL),
            source: "N",
        };
    }

    return {
        decompose: decomposeInner,
        knownWord: (word: string): boolean => dict.has(word),
        g2p(word: string): string {
            const d = decomposeInner(word);
            // Compound/morph pieces are pre-resolved dict pronunciations — pass NO word so arpabetToIpa doesn't
            // re-fire the single-morpheme rules (barred-i) on a compound (subreddit ends "-it" but isn't -it
            // suffixed). The n-gram path IS a single OOV morpheme, so pass the word (de-/re- reduction applies).
            return arpabetToIpa(d.phones, d.source === "N" ? word : "");
        },
    };
}
