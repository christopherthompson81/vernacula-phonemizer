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
 * `tools/english/en_g2p_ngram.ts --emit`; the shipped artifact is `g2p-model.bin` (`g2p_model_pack.mts` packs the
 * emitted JSON; layout in `g2pModelBinary.ts`).
 * ⚠ NOT THE SAME MODEL AS THE NEURAL PATH: `en-g2p-tagger.onnx` is a separate BiLSTM built by
 * `tools/english/en_g2p_bilstm.py` and used by englishTagger.ts. This file is the SYNC n-gram fallback.
 * ⚠ A PURE FUNCTION of its injected {model, dict, common, arpabetToIpa} — no filesystem, no globals — which is
 * what makes it portable.
 */

/** The trainer's model as JSON: a joint n-gram over grapheme:phone tokens (`en_g2p_ngram.ts --emit`). The engine
 *  takes it packed ({@link PackedG2pModel}, `g2pModelBinary.ts`). */
export interface EnglishG2pModel {
    order: number;
    alpha: number;
    evp: number;
    evpOrder: number;
    graphemeChunks: Record<string, string[]>;
    /** key `${order}|${ctx}` → { t: full context total, c: pruned top-K [chunk, count] }. */
    ngram: Record<string, { t: number; c: [string, number][] }>;
}

/** The model as the engine takes it: the JSON's tokens as ids, its contexts and candidates as flat arrays
 *  (`g2pModelBinary.ts`, which loads it from `g2p-model.bin`). */
export interface PackedG2pModel {
    order: number;
    alpha: number;
    evp: number;
    evpOrder: number;
    minCount: number;
    graphemeChunks: Record<string, string[]>;
    tokens: string[];
    ctxOrder: Uint8Array;
    /** Four slots per context; an order-`o` context uses the last `o`. */
    ctxTok: Uint16Array;
    total: Uint32Array;
    rowStart: Uint32Array;
    cand: Uint16Array;
    count: Uint32Array;
}

/** An empty context slot in {@link PackedG2pModel.ctxTok}. */
export const PAD = 0xffff;

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
    /** First pieces after which the STEM keeps the primary — see english.jsonc for the measurement. */
    stemStressPrefixes: string[];
    /** Letters whose NAME is not spelled by the letter itself (`a` → `ay`, `i` → `eye`). Injected so the
     *  splitter can recognise a dictionary row that is an INITIALISM rather than a word — see
     *  `isLetterNameRow`. Same two entries `normalize.ts` uses to spell a run out. */
    letterNameExceptions: Record<string, string>;
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
    /** A derivational form read from its DICTIONARY STEM (`castable` = `cast` + -able), or undefined when the
     *  word has no such suffix or its stem is unknown. Deterministic, so the resolver prefers it to the neural
     *  tagger, which reads `castable` as `caste` + -able (#1504). */
    derived(word: string): string | undefined;
}

/**
 * Build the engine from a model + the CMUdict ARPABET dict (word → phones, for compound pieces / morph
 * stems) + the `common`-word set (frequency gate for compound pieces). Injected, not loaded, so this file
 * is pure and mirror-friendly.
 */
export function createEnglishG2p(
    model: PackedG2pModel,
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
    const STEM_STRESS_PREFIX = new Set(classes.stemStressPrefixes);

    /**
     * ⚠ 210 ROWS OF `g2p-dict.tsv` ARE AN INITIALISM SPELLED OUT, NOT A WORD — `abs` is EY1 B IY1 EH1 S
     * ("A-B-S"), `abd`, `ach`, `mph`, `ati`, `ona`, `cia`, `apo`. They are correct AS WHOLE WORDS, and
     * catastrophic as PIECES of a longer one, because `compoundSplit` and `morphDecode` will happily
     * reach for any dictionary row of three or more letters:
     *
     *     absent     [abs|ent]        EY1 B IY1 EH1 S EH2 N T          "A-B-S-ent"
     *     abdomen    [abd|omen]       EY2 B IY2 D IY1 OW2 M AH0 N      "A-B-D-omen"
     *     treacher   [tre|ach+er]     T R EY1 EY2 S IY2 EY2 CH ER0     "tray-A-C-H-er"
     *     accrington [acc|ring|ton]   EY2 S IY2 S IY1 R IH2 NG T AH2 N
     *
     * Measured (#1382): 287 dictionary words would decode this way if they were unrecorded, and 131 of
     * the wikipron-UK headwords we do NOT carry actually do. `abs-` and `abd-` alone poison a whole
     * orthographic neighbourhood.
     *
     * ⚠ DERIVED, NOT LISTED. CMUdict names all 26 letters, so the reading of an initialism is already in
     * the dictionary and a 210-row table would only go stale against it. The two letters whose NAME is
     * spelled differently from the letter (`a` → `ay`, `i` → `eye`) come from the same manifest key
     * `normalize.ts` spells runs with, so the two places cannot drift apart.
     *
     * ⚠ AND IT REJECTS A PIECE, NEVER A WORD. `abs`, `abc` and `mph` remain correct when they ARE the
     * word — a whole-word lookup never comes through here, because a recorded word does not take the OOV
     * path at all.
     */
    const letterPhones = (l: string): string[] | undefined => dict.get(classes.letterNameExceptions[l] ?? l);
    /**
     * ⚠ NOT MEMOIZED, AND THAT IS DELIBERATE. A cache keyed on a word is a cache keyed on `dict`, and
     * `dict` is exactly what this repo's tests MUTATE: `en-curation-gap.test.ts` holds each word out, and
     * a sweep that deletes and restores one word at a time poisons the entry for any piece that happened
     * to be the held-out word when it was first asked — the answer flips to `false` and stays there. It
     * cost an hour of chasing a residue that was not in the engine at all. The predicate is a handful of
     * array reads; a stale `true` here silently un-fixes #1382 for one piece and nothing would catch it.
     */
    function isLetterNameRow(piece: string): boolean {
        const phones = dict.get(piece);
        if (phones === undefined || piece.length < 2) return false;
        const want: string[] = [];
        for (const l of piece) {
            const lp = letterPhones(l);
            if (lp === undefined) return false;
            want.push(...lp);
        }
        return want.length === phones.length
            && want.every((x, i) => dropStress(x) === dropStress(phones[i]!));
    }


    // --- joint n-gram: stupid-backoff score + order matched (for the guessed-silence penalty) ---
    //
    // ⚠ THE DECODER IS THE OOV PATH'S WHOLE COST, so its inner loop allocates nothing it can avoid. Min Nan's
    // Latin runs (place names: Ukraina, Lietuva) reach it through the English reader, and the straightforward
    // form — a linear `find` over each context's candidates, the context strings rebuilt for every candidate
    // chunk, and the full history and phone arrays copied into every candidate — spent ~14 ms a word
    // (docs/investigations/nan/nan_csharp_perf_investigation.md, Run 4). Output is unchanged by construction.
    //
    // ⚠ TOKENS ARE IDS (`g2pModelBinary.ts`). A context is the number `((((o·B + a)·B + b)·B + c)·B + d)` over its
    // four slots, `B` = tokens + 1 with the last digit standing for an empty slot, so no context string is ever
    // built. A token the model never saw is `UNSEEN`: any context holding it misses, and it is never a candidate —
    // exactly what the string lookup did for it.
    const UNSEEN = -1;
    const tokenId = new Map<string, number>(model.tokens.map((t, i) => [t, i]));
    const B = model.tokens.length + 1;
    if (5 * B ** 4 >= Number.MAX_SAFE_INTEGER) throw new Error(`g2p-model: ${model.tokens.length} tokens overflow the context key`);
    const ctxKey = (o: number, slots: ArrayLike<number>, at: number): number => {
        let k = o;
        for (let j = 0; j < 4; j++) {
            const t = slots[at + j]!;
            k = k * B + (t === PAD ? B - 1 : t);
        }
        return k;
    };
    const ctxIndex = new Map<number, number>();
    for (let i = 0; i < model.ctxOrder.length; i++) ctxIndex.set(ctxKey(model.ctxOrder[i]!, model.ctxTok, i * 4), i);
    type Ctx = { t: number; counts: Map<number, number> };
    const ctxCache = new Map<number, Ctx>();
    /** Context `i`'s candidates as a lookup, built on first use. The FIRST occurrence of a token wins, as `find` did. */
    function context(i: number): Ctx {
        let c = ctxCache.get(i);
        if (c === undefined) {
            const counts = new Map<number, number>();
            for (let k = model.rowStart[i]!; k < model.rowStart[i + 1]!; k++)
                if (!counts.has(model.cand[k]!)) counts.set(model.cand[k]!, model.count[k]!);
            c = { t: model.total[i]!, counts };
            ctxCache.set(i, c);
        }
        return c;
    }
    /** `hist`'s contexts, longest first (index `order - 1 - o` is order `o`). They depend only on the history,
     *  so they are resolved once per hypothesis, not once per candidate chunk. */
    const slots = [PAD, PAD, PAD, PAD];
    function contexts(hist: number[]): (Ctx | null)[] {
        const out: (Ctx | null)[] = [];
        for (let o = order - 1; o >= 0; o--) {
            let seen = true;
            for (let j = 0; j < 4; j++) {
                const t = j < 4 - o ? PAD : hist[hist.length - 4 + j]!;
                if (t === UNSEEN) seen = false;
                slots[j] = t;
            }
            const i = seen ? ctxIndex.get(ctxKey(o, slots, 0)) : undefined;
            out.push(i === undefined ? null : context(i));
        }
        return out;
    }
    function scoreTokAt(ctxs: (Ctx | null)[], tok: number): [number, number] {
        for (let o = order - 1; o >= 0; o--) {
            // e.c stores the JOINT tokens `${letter}:${chunk}` (as trained), so match the full token.
            const e = ctxs[order - 1 - o];
            const n = e?.counts.get(tok);
            if (n !== undefined) return [Math.log(n / e!.t) + (order - 1 - o) * Math.log(alpha), o];
        }
        return [Math.log(1e-7), -1];
    }
    /** A hypothesis's phones: a chain back to the start, flattened once at the end. */
    type Phones = { chunk: string[]; prev: Phones | null } | null;
    function flatten(p: Phones): string[] {
        const parts: string[][] = [];
        for (; p; p = p.prev) parts.push(p.chunk);
        return parts.reverse().flat();
    }
    /** The last `order - 1` tokens: all `contexts` ever reads. */
    const keep = Math.max(order - 1, 0);
    const window = (hist: number[]): number[] => (keep === 0 ? [] : hist.slice(-keep));
    const startId = tokenId.get(START) ?? UNSEEN;
    function ngramDecode(w: string): string[] {
        let beam: { hist: number[]; phones: Phones; score: number }[] = [
            {
                hist: window([startId, startId, startId, startId]),
                phones: null,
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
            // Per letter, not per hypothesis: each chunk's joint token and its phones.
            const toks = chunks.map((ch) => tokenId.get(`${c}:${ch}`) ?? UNSEEN);
            const pieces = chunks.map((ch) => (ch ? ch.split(" ") : null));
            // Scored first, built only if it survives: (score, hypothesis, chunk) in insertion order.
            const next: { score: number; h: (typeof beam)[number]; k: number }[] = [];
            for (const h of beam) {
                const ctxs = contexts(h.hist);
                for (let k = 0; k < chunks.length; k++) {
                    const chunk = chunks[k]!;
                    const [lp, ord] = scoreTokAt(ctxs, toks[k]!);
                    let s = h.score + lp;
                    if (chunk === "" && emptyPenalized && ord < evpOrder)
                        s -= evp;
                    if (chunk === "" && finalConsonant) s -= evp / 2;
                    next.push({ score: s, h, k });
                }
            }
            // ⚠ A STABLE sort (Array.prototype.sort is): equal scores keep insertion order, which the C# and Rust
            // ports mirror, so the surviving hypothesis on a tie is the same everywhere.
            next.sort((a, b) => b.score - a.score);
            beam = next.slice(0, BEAM).map(({ score, h, k }) => {
                const ps = pieces[k];
                return {
                    hist: window([...h.hist, toks[k]!]),
                    phones: ps ? { chunk: ps, prev: h.phones } : h.phones,
                    score,
                };
            });
        }
        return flatten(beam[0]!.phones);
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
    /** Suffixes `morphDecode` serves only to a WHOLE word, never to `compoundSplit`'s final piece (#1504): a
     *  piece built as stem+able lets the splitter compose `in|credible` and `ap|plicable` with the stress on
     *  the first piece. Measured on the held-out dict -able/-ible words: see en_able_suffix_investigation.md. */
    const DERIVATIONAL_ONLY = new Set(["able", "ible"]);
    /** The inflections an INITIALISM genuinely takes — see `morphDecode`. */
    const PLURAL_SUFFIX = new Set(["s", "es", "sses"]);
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
        // ⚠ -able/-ible PREFER THE STEM WITHOUT ⟨e⟩ (#1504). `castable` is `cast`, not `caste`; `lovable` falls
        // back to `love` only because `lov` is not a word. A doubled consonant (`forgettable`) drops one, and
        // `-iable` restores the ⟨y⟩ (`reliable` → `rely`). The suffix is the dictionary's own AH0 B AH0 L
        // (655 of the -able rows, 123 of the -ible). `able`/`ible` are also stop pieces, or the compound
        // splitter claims `cast|able` first and the piece keeps the full vowel of the word *able*.
        [
            "able",
            // `-iable` tries the ⟨y⟩ stem FIRST: `reli` is a dictionary row too (a name, R EH1 L IY0), and
            // bare-first read `reliable` as *RELL-ee-able*.
            (w) => [
                ...(w.at(-5) === "i" ? [w.slice(0, -5) + "y"] : []),
                w.slice(0, -4),
                w.slice(0, -4) + "e",
                ...(w.at(-5) === w.at(-6) ? [w.slice(0, -5)] : []),
            ],
            () => ["AH0", "B", "AH0", "L"],
        ],
        ["ible", (w) => [w.slice(0, -4), w.slice(0, -4) + "e"], () => ["AH0", "B", "AH0", "L"]],
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
    /**
     * ⚠ `asPiece` EXISTS BECAUSE THE INITIALISM GUARD BELONGS TO THE PIECE SITE, NOT TO THIS FUNCTION.
     * Rejecting a letter-name STEM outright also blocks the CORRECT decode of an initialism's plural,
     * which is the one morphological thing initialisms do: `mphs` became "em-pee-aitch-ESS" instead of
     * "em-pee-aitch-ez", `lcds` and `crts` likewise. It also mis-fires on an ordinary row that merely
     * coincides with its letter names — `ok` is `OW1 K EY1`, i.e. ⟨o⟩+⟨k⟩, so `oks` became "oaks".
     * ⚠ AND THE EXEMPTION IS THE PLURAL SUFFIX, NOT A PROPERTY OF THE STEM, which is the opposite of
     * what the obvious fix suggests. Gating on "the stem has no vowel letter" separates `mph`+`s` from
     * `ba`+`s` — and then breaks fourteen genuine initialism plurals to save one. Measured over
     * `dict ∪ referee`, words of the shape <letter-name row> + `s` number 15, and 14 of them have a
     * VOWEL in the stem: `abcs`, `apis`, `suvs`, `ufos`, `urls`, `vips`, `duis`, `byus`, `csis`, `hbos`.
     * The vowel says nothing; the SUFFIX does. Cost of exempting it: `bas`, `baas`, `clos`, `amas`,
     * `mmes` — rows where the predicate has a false positive (`baa` really is `B IY EY EY`) — against
     * thirteen common words read correctly. `bas` is two golden rows, in French place names delegated
     * from Hakka and Min Nan.
     * Only `compoundSplit` needs the rejection for everything else, for `treacher` = `tre` +
     * `acher`→`ach`+`er`.
     */
    function morphDecode(w: string, asPiece = false): string[] | null {
        for (const [suf, stems, allo] of SUFFIXES) {
            if (!w.endsWith(suf) || w.length <= suf.length + 1) continue;
            if (asPiece && DERIVATIONAL_ONLY.has(suf)) continue;
            for (const stem of stems(w)) {
                if (stem.length < 2) continue;
                // `ach` + `er` is not how `acher` is read — but `mph` + `s` IS how `mphs` is read.
                if (isLetterNameRow(stem) && (asPiece || !PLURAL_SUFFIX.has(suf))) continue;
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
            /** ⚠ THE FIRST PIECE'S SPELLING, carried because the STRESS POLICY below needs it and the
             *  phones cannot supply it: `dis` and `diss` decode alike, and a prefix is a fact about the
             *  morphology, not about the phones the piece happens to have. */
            head: string;
            nparts: number;
            minLen: number;
            score: number;
        } | null)[] = new Array(n + 1).fill(null);
        best[0] = { parts: [], head: "", nparts: 0, minLen: Infinity, score: 0 };
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
                // ⚠ AN INITIALISM ROW IS NOT A PIECE — see `isLetterNameRow`. Tested BEFORE the
                // morphDecode fallback, so `acher` cannot smuggle `ach` in through the suffix table.
                let phones = isLetterNameRow(piece) ? null : dict.get(piece) ?? null;
                if (!phones && j === n && j - i >= 5) {
                    const mp = morphDecode(piece, true);
                    if (mp) phones = mp;
                }
                if (!phones) continue;
                const cand = {
                    parts: [...best[i]!.parts, phones],
                    head: i === 0 ? piece : best[i]!.head,
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
        /**
         * ⚠ THIS USED TO BE UNCONDITIONAL FORE-STRESS — `(idx === 0 ? p : stressDown(p))` — and that is
         * right for a COMPOUND (`BACK·yard`, `HEAD·mistress`) and wrong for a prefixed form, where the
         * stem keeps the primary (`dis·AGREE`, `mis·LEAD`, `inter·CEPT`). #1379's stress audit made it
         * visible: 32 of the 59 curation gaps it opened had this one cause.
         *
         * ⚠ AND #1379 MEASURED THE FIX AND REFUSED IT, ON THE WRONG POPULATION. It scored the
         * discriminator over its own 233 CANDIDATES — by construction the rows where our placement was
         * already wrong — got two-thirds each way, and called that "not a rule". Over the 13,661 words
         * the path actually decodes, scored against the dictionary:
         *
         *     fore-stress always (as shipped)                 78.8%
         *     stem-stress always                              20.3%
         *     keyed on en-morph-boundary.tsv's `prefix` label  83.1%
         *     this list                                        84.0%   ← +710 words
         *
         * ⚠ THE LIST BEATS THE TABLE, which is why the table is not a runtime dependency. It also could
         * not be one: `tools/gen/en-morph-boundary.tsv` ships in neither package, and it cannot speak to
         * a word Wiktionary does not carry — which is most of what reaches an OOV path. The table found
         * the class; the list is how the engine expresses it, and it ports.
         */
        // ⚠ THE STEM IS PIECE 1, NOT THE LAST PIECE, and those are the same thing only for a two-piece
        // split — which every example above is, which is why `parts.length - 1` read as correct. On a
        // three-piece split it put the primary on the final FRAGMENT, normally a suffix English never
        // stresses: `dis|pos|able` came out D IH2 S P AA2 S EY1 B AH0 L and `inter|cept|or`
        // IH2 N T ER2 S EH2 P T AO1 R. Measured over the 65 validated three-plus-piece splits with a
        // stem-stress head: primary on the LAST piece 12, on the FIRST (the old policy) 13, on the
        // SECOND 35. The bug was worth −1 against the rule it replaced, on that subpopulation.
        if (STEM_STRESS_PREFIX.has(full.head))
            return full.parts.flatMap((p, idx) => (idx === 1 ? p : stressDown(p)));
        return full.parts.flatMap((p, idx) => (idx === 0 ? p : stressDown(p)));
    }

    /**
     * ⚠ A READING WITH NO VOWEL NUCLEUS IS NOT A PRONUNCIATION, IT IS A FAILURE. `blt` came out
     * `B L T`, `frb` `F R B`, `hdd` `HH D` — phone strings nothing can say, which a TTS then renders at
     * length. 186 words in the swept population produce one (#1382), every single one of them source N:
     * the n-gram is asked to read a string of consonants and obligingly returns consonants.
     *
     * ⚠ THE CAUSE IS A CASE GATE, NOT THE n-GRAM. `core/initialisms.ts` reads these correctly — `BLT` is
     * bˈiː ˈɛɫ tʰˈiː — but it only matches ALL-CAPS runs, deliberately, because in cased text the capitals
     * are the signal that a run is an initialism. Lowercase `blt` never reaches it. This is the safety
     * net under that gate, not a second opinion about case: it fires only when the result is unsayable.
     *
     * ⚠ AND NOTHING CORRECT IS AT RISK, WHICH IS THE WHOLE ARGUMENT FOR IT. English does have vowelless
     * words — `hm`, `hmm`, `mm`, `sh`, `shh` are syllabic-consonant interjections and all 8 vowelless
     * rows in `g2p-dict.tsv` are that shape — but a RECORDED word never takes the OOV path, so this code
     * cannot see them. Every vowelless output it can see is already broken.
     *
     * ⚠ THE ONE EXEMPTION IS ELONGATION. An unrecorded `hmmmm`, `shhh`, `zzz`, `brrr` is an interjection
     * spelled long, and "aitch em em em em" would be a worse answer than the `HH M` it gets today.
     * ⚠ AND IT IS A RUN OF **THREE**, NOT A DOUBLED LETTER, which the first version got wrong: "every
     * letter after the first is the same" exempts `hdd` and `cnn`, the very initialisms this exists to
     * catch. A doubled final letter is ordinary English; a TRIPLED one is someone leaning on a key.
     *
     * ⚠ AND THE NET DECLINES TWO-LETTER RUNS, WHICH COSTS 51 OF THE 186 AND IS TAKEN DELIBERATELY. At
     * that length an English initialism (`fm`, `hz`, `mr`, `ms`) is indistinguishable from a ROMANISATION
     * DIGRAPH reaching this path through foreign-run delegation, and the goldens are full of the second
     * kind — `sh` and `seh` in a Hakka romanisation, `zh` in Pinyin, `rr` in a Vietnamese sentence ABOUT
     * the letters ⟨rr⟩, `Plč` in Czech. Spelling those out as English letter names is a worse answer than
     * the unsayable cluster, and nothing at two letters tells the engine which it is holding. Every
     * initialism the issue actually reported — `blt`, `frb`, `gpt`, `dwp`, `hdd`, `bdsm`, `kph` — is
     * three or more.
     *
     * ⚠ AND FOUR GOLDEN ROWS GET WORSE, ALL OF ONE SHAPE, RECORDED RATHER THAN HIDDEN. A romanisation
     * fragment of three or more letters still reaches this net through foreign-run delegation and is
     * spelled out as English letters: `sch` in a Hakka romanisation, `Tsz` in a Cantonese one, `Plč` in
     * Czech, `zh` in Pinyin context, `trọ` in Vietnamese. They were unsayable clusters before and are
     * long English letter-name strings now — differently wrong, not newly wrong. The real remedy is not
     * in this function: a Latin-script fragment of a language this engine is not reading should not be
     * arriving at the ENGLISH OOV path at all, and nothing at this level can tell that it has. Named so
     * the next person has the class rather than the symptom.
     */
    const hasNucleus = (ph: readonly string[]): boolean => ph.some((p) => VOWEL.has(dropStress(p)));
    const isElongation = (w: string): boolean =>
        w.length >= 3 && w[w.length - 1] === w[w.length - 2] && w[w.length - 2] === w[w.length - 3];
    function spellOutPhones(w: string): string[] | null {
        const out: string[] = [];
        for (const l of w) {
            const lp = letterPhones(l);
            if (lp === undefined) return null;   // no letter name: leave the decode alone
            out.push(...lp);
        }
        return out.length > 0 ? out : null;
    }

    function decomposeInner(w: string): {
        phones: string[];
        source: "C" | "M" | "N";
    } {
        // ⚠ A DERIVATIONAL SUFFIX OUTRANKS THE COMPOUND SPLIT (#1504). `able` is a common word, so the splitter
        // reads `accept|able` with the full vowel of the word *able* (… T EY2 B AH0 L); the suffix row reduces it.
        const derived = [...DERIVATIONAL_ONLY].some((suf) => w.endsWith(suf)) ? morphDecode(w) : null;
        const c = derived ? null : compoundSplit(w);
        if (c)
            return {
                phones: enforceSinglePrimary(collapseGeminates(c, VOWEL), VOWEL),
                source: "C",
            };
        const m = derived ?? morphDecode(w);
        if (m)
            return {
                phones: enforceSinglePrimary(collapseGeminates(m, VOWEL), VOWEL),
                source: "M",
            };
        const n = enforceSinglePrimary(collapseGeminates(ngramDecode(w), VOWEL), VOWEL);
        // The unsayable-output net — see the comment above `decomposeInner`.
        if (w.length >= 2 && !hasNucleus(n) && !isElongation(w)) {
            // ⚠ A TRAILING `s` ON AN INITIALISM IS THE PLURAL, NOT THE LETTER ESS. `blts` was
            // "bee-ell-tee-ESS" while `blt's` — which the clitic strip reaches first — was correctly
            // "bee-ell-tees". The same word with and without an apostrophe must not disagree.
            const plural = w.endsWith("s") && w.length >= 4 && !/[aeiouy]/u.test(w.slice(0, -1));
            const spelled = spellOutPhones(plural ? w.slice(0, -1) : w);
            if (spelled !== null) {
                return { phones: enforceSinglePrimary(plural ? [...spelled, "Z"] : spelled, VOWEL), source: "N" };
            }
        }
        return { phones: n, source: "N" };
    }

    return {
        decompose: decomposeInner,
        derived(word: string): string | undefined {
            if (![...DERIVATIONAL_ONLY].some((suf) => word.endsWith(suf))) return undefined;
            const m = morphDecode(word);
            return m ? arpabetToIpa(enforceSinglePrimary(collapseGeminates(m, VOWEL), VOWEL), word) : undefined;
        },
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
