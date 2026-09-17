/**
 * English-native OOV G2P.
 *
 * For words NOT in the CMUdict pronunciation lexicon. Compositional-first (real OOV is ~all compounds/
 * inflections of known words), with a joint-sequence n-gram fallback for the non-compositional tail:
 *
 *   compound-split (dict pieces + compound stress) → suffix morphology → joint n-gram beam decode
 *
 * All paths emit stress-bearing ARPABET; {@link arpabetToIpa} renders the SAME canonical convention as the
 * dict, so a sentence mixing dict + G2P words has no seam. Trained cleanroom on CMUdict (public domain) by
 * `tools/english/en_g2p_ngram.ts --emit`; the shipped artifact is `g2p-model.json`.
 * ⚠ NOT THE SAME MODEL AS THE NEURAL PATH: `en-g2p-tagger.onnx` is a separate BiLSTM built by
 * `tools/english/en_g2p_bilstm.py` and used by englishTagger.ts. This file is the SYNC n-gram fallback.
 * ⚠ A PURE FUNCTION of its injected {model, dict, common, arpabetToIpa} — no filesystem, no globals — which is
 * what makes it portable.
 */

/** Serialized model: a joint n-gram over grapheme:phone tokens (`en_g2p_ngram.ts --emit`). */
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

/** A predictor (n-gram OR the BiLSTM tagger) emits a digit per position with no global constraint, so it can
 *  return ZERO `1`s for a short or odd word; PROMOTE the first vowel to primary so every content word carries
 *  a tonic. Exported so englishTagger.ts shares it with the n-gram path.
 *
 *  ⚠ THIS USED TO ALSO DEMOTE — several `1`s, keep the FIRST — and that half now lives in `singlePrimary`,
 *  inside `arpabetToIpa`. It had to move because it was only reachable from the OOV paths: the DICTIONARY
 *  path does not come through this function, so 1,029 `g2p-dict.tsv` rows with more than one stress-1
 *  nucleus were rendered verbatim and 372 words were emitted with two or three primary marks in one group.
 *
 *  ⚠ AND IT HAD TO MOVE RATHER THAN BE COPIED, because keeping a demotion here as well made the SAME
 *  ARPABET read two different ways depending on which path delivered it — `AA1 R CH B IH1 SH AH0 P` came out
 *  `ˈɑːɹt͡ʃbɪʃəp` through the predictor and `ˌɑːɹt͡ʃbˈɪʃəp` through the dictionary. That is the seam this repo
 *  keeps a curation gate to catch, and the argument for allowing it (that a predictor's extra `1` is noise
 *  while CMUdict's is a statement) does not survive contact with the COMPOUND path, which joins two dict
 *  stems each carrying its own real primary. One function, one policy, both paths.
 *
 *  The "at least one" half stays here, because only a predictor can return zero primaries: a dictionary row
 *  always has one, and promoting inside the converter would invent a tonic for the function words that
 *  correctly carry none. */
export function enforceSinglePrimary(ph: string[], vowels: ReadonlySet<string>): string[] {
    const out = [...ph];
    if (!out.some((p) => /1$/.test(p))) {
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
     *  excluded HOMOGRAPH (read/use/close) — the router keeps the POS-gated output rather than
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
            // ⚠ A WORD-FINAL CONSONANT LETTER THAT SAYS NOTHING IS PENALISED TOO — at HALF the vowel penalty and
            // REGARDLESS of the order the empty chunk was found at (#1265). The vowel rule exempts an empty chunk
            // found at order ≥ 3 so attested silences pass; but CMUdict carries enough French (`Illinois`, `corps`,
            // `Des Moines`) that a silent final `s` after `…ne` is attested at order 3, and `GIF` read *ɡˈɪ*, `ISIL`
            // *ˈɪsɪ*, `SNES` *sn*. Measured on the held-out tenth (docs/investigations/en/en_oov_final_consonant_investigation.md):
            //     baseline            word-acc 47.20%  PER 13.71%  final consonant lost 216
            //     full evp, no order  46.98%           13.72%      44      ← fewer lost, but ordinary words pay
            //     HALF evp, no order  47.39%           13.62%      71      ← taken: nothing gets worse
            // Not `y` (a vowel letter in this position: `croy`), not a doubled letter (`ll`, `ss`, `tt` — the
            // second says nothing by design). `lamb`/`damn` are dictionary words and never reach this decoder.
            const finalConsonant =
                i === w.length - 1 && /^[a-z]$/u.test(c) && !VOWEL_LETTER.has(c) && c !== "y" && w[i - 1] !== c;
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
                    if (chunk === "" && finalConsonant) s -= evp / 2;
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
    /**
     * ⚠ THE JOIN IS NOT A CONCATENATION for an `-ire` stem. CMUdict writes word-final `-ire` as `… AY ER`
     * — correct, a syllabic `ɚ` — and that stays before a CONSONANT allomorph (`misfires` AY1 ER0 Z). Before
     * a VOWEL-initial one the rhotic resyllabifies as that syllable's onset (`firing` F AY1 R IH0 NG), and
     * pasting the stem on unchanged reproduces the exact defect #1289 fixed in the dict — but on an OPEN
     * class: `misfiring`, `umpiring`, `attiring` are all unlisted and all took `AY1 ER0 IH0 NG`.
     *
     * ⚠ THE CONDITION IS THE STEM'S SPELLING, NOT THE PRECEDING VOWEL. Tabulated over every attested
     * stem/derivative pair in the dict (see docs/investigations/en/en_oov_curation_gap_investigation.md):
     * conditioning on a preceding `AY` scores 15:5, conditioning on a `-ire` spelling scores 15:2. A plain
     * `ER`-before-vowel rule would be WRONG: `water` + `ing` is W AO1 T ER0 IH0 NG, and 429 such pairs keep
     * the `ER`.
     *
     * ⚠ AN `ER`-INITIAL ALLOMORPH IS NOT EXEMPT — AND THE EVIDENCE HERE IS THIN, SO IT IS STATED STRAIGHT.
     * A first version carved that case out, on the claim that the only counterexamples were
     * `acquire → acquirer(s)` AH0 K W AY1 ER0 ER0 and that excluding them made the rule 15:0. Both halves
     * were wrong. `enquire` IH0 N K W AY1 ER0 → `enquirer` IH0 N K W AY1 R ER0 is an attested `-ire`-stem
     * pair that DOES resyllabify before an `ER` allomorph, so the strict tally for that environment is
     * 1 resyllabifying against 2 keeping — a MINORITY, not 15:0.
     *
     * It is dropped anyway, for two reasons that do not depend on that tally:
     *   1. The dict's surface shape for `-irer` is `AY1 R ER0` in `enquirer`, `inquirer` and `admirer`
     *      against `AY1 ER0 ER0` in `acquirer`/`acquirers` — 3:2 — and the minority spelling is a DOUBLED
     *      rhotic nucleus, which is what an unlisted word inherited (`conspirer` → kənspˈaᶦɚɚ).
     *   2. `acquirer`/`acquirers` are IN THE DICT. The OOV path never reaches them, so the exemption
     *      protected two rows the dict already protects and charged the open class for it.
     * Measured: dropping it moves 3 dict rows — `enquirer` right, `acquirer`/`acquirers` wrong — a held-out
     * net of −1 on words that in production are always answered from the dict, in exchange for the whole
     * unlisted `-irer` class. No corpus row covers `-irer`; if one ever does, this is the clause to re-open.
     *
     * ⚠ AND IT REPRODUCES #1289's OWN EXCLUSIONS rather than overriding them: `friar → friary`,
     * `prior → priory` and `spier → spiering` are `AY`-but-not-`-ire`, and that issue had already decided
     * each of them keeps its `ɚ`. That the spelling cut agrees is the evidence it is cut at the right joint.
     */
    function joinMorph(stem: string, sp: string[], suffix: string[]): string[] {
        const last = sp[sp.length - 1];
        if (
            last === undefined
            || !stem.endsWith("ire")
            || dropStress(last) !== "ER"
            || suffix.length === 0
            || !VOWEL.has(dropStress(suffix[0]!))
        ) {
            return [...sp, ...suffix];
        }
        return [...sp.slice(0, -1), "R", ...suffix];
    }
    function morphDecode(w: string): string[] | null {
        for (const [suf, stems, allo] of SUFFIXES) {
            if (!w.endsWith(suf) || w.length <= suf.length + 1) continue;
            for (const stem of stems(w)) {
                if (stem.length < 2) continue;
                const sp = dict.get(stem);
                if (!sp) continue;
                return joinMorph(stem, sp, allo(sp));
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
            // ⚠ THE COMPOUND PATH PASSES NO WORD, so arpabetToIpa cannot re-fire the single-morpheme rules
            // (barred-i) on a split that only LOOKS suffixed — `subreddit` ends "-it" but is not -it suffixed.
            // ⚠ A MORPH DECOMPOSITION IS NOT A COMPOUND, and lumping the two cost the suffix rules the very
            // words they exist for: `morphDecode` fires only when the word ends in a KNOWN suffix whose stem
            // is in the dictionary, so the suffix is real by construction. Withholding the word there left
            // an OOV plural spelled differently from a recorded one in the same environment — `quiches`
            // ᵻ→ɪ beside `niches` ᵻ — which is the two-spellings-per-morpheme defect this rule removes,
            // reappearing on the path the lexicon cannot cover. The n-gram path is a single OOV morpheme
            // and always passed the word.
            return arpabetToIpa(d.phones, d.source === "C" ? "" : word);
        },
    };
}
