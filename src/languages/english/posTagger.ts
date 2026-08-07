/**
 * Pure-TS averaged-perceptron POS tagger.
 *
 * Drives English homograph disambiguation — the `$verb`/`$noun`/`$past`
 * dictionary conditionals — with a real part-of-speech tagger.
 *
 * Zero runtime dependencies. The model artifact is trained OFFLINE on UD English-EWT
 * XPOS (Penn Treebank tags) by `tools/english/en_pos_train.ts` and shipped as the
 * data file `pos-model.json`; `pos-model.PROVENANCE.md` records where the weights
 * came from.
 * ⚠ THIS MODULE IS THE SINGLE SOURCE OF TRUTH FOR FEATURE EXTRACTION — the trainer
 * imports {@link extractFeatures} from here, so train-time and run-time features
 * cannot drift. Changing it invalidates the shipped weights.
 *
 * Tags are the Penn Treebank tagset (VB/VBP/VBZ/VBG/VBN/VBD verbal forms,
 * NN/NNS/NNP nominal forms, JJ adjectives, …). We need the full PTB set rather
 * than coarse UPOS because the homograph data distinguishes past tense
 * (`read` → ɹɛd needs VBD/VBN) from base/present forms.
 */

export const START = "-START-";
export const END = "-END-";

/** Normalize a token the way the trainer did: years, numbers, digit-bearing tokens. */
export function normalizeToken(word: string): string {
    if (word.length === 4 && /^[0-9]+$/.test(word)) return "!YEAR";
    const first = word[0];
    if (first !== undefined && first >= "0" && first <= "9") return "!DIGITS";
    return word.toLowerCase();
}

/**
 * Honnibal/Collins feature set. `word` is the NORMALIZED token (see
 * {@link normalizeToken}); `context` is the normalized word stream padded with
 * two START tokens at the front and two END tokens at the back, so the token at
 * sentence position `i` lives at `context[i + 2]`.
 *
 * NOTE (PII-scrub coupling, #687): the trainer's PII filter identifies which
 * weights carry a raw corpus token by string-matching the feature key — a key
 * "carries a token" iff it contains "word", and the token is its last
 * space-delimited field. Every word-bearing feature below therefore ends in the
 * token. If you add a feature whose key contains "word" but whose last field is
 * NOT a corpus token, update `lexicalToken` in `tools/english/en_pos_train.ts` to
 * match, or its PII scrub will mis-classify the feature.
 */
export function extractFeatures(
    i: number,
    word: string,
    context: string[],
    prev: string,
    prev2: string,
): Record<string, number> {
    const feats: Record<string, number> = {};
    const add = (...parts: string[]) => {
        feats[parts.join(" ")] = 1;
    };
    const c = i + 2; // index into padded context (always in-bounds: two START + two END pads)
    const at = (k: number) => context[k] ?? "";
    const suffix = (w: string) => w.slice(-3);
    add("bias");
    add("i suffix", suffix(word));
    add("i pref1", word[0] ?? "");
    add("i-1 tag", prev);
    add("i-2 tag", prev2);
    add("i tag+i-2 tag", prev, prev2);
    add("i word", at(c));
    add("i-1 tag+i word", prev, at(c));
    add("i-1 word", at(c - 1));
    add("i-1 suffix", suffix(at(c - 1)));
    add("i-2 word", at(c - 2));
    add("i+1 word", at(c + 1));
    add("i+1 suffix", suffix(at(c + 1)));
    add("i+2 word", at(c + 2));
    return feats;
}

/**
 * Coarse POS expectations consumed by the dictionary homograph gating
 * (`$verb`/`$noun`/`$past`). VBD/VBN are BOTH verbal and past — so "read it
 * yesterday" (VBD) sets both `verb` and `past`, letting `read rEd $past` win,
 * while "they lead" (VBP) sets `verb` so the verb pronunciation wins.
 */
export interface PosExpectation {
    verb: boolean;
    noun: boolean;
    past: boolean;
}

/** Map a Penn-Treebank tag to {@link PosExpectation}. */
export function posExpectation(tag: string): PosExpectation {
    return {
        verb: tag === "MD" || tag.startsWith("VB"),
        noun: tag.startsWith("NN"),
        past: tag === "VBD" || tag === "VBN",
    };
}

/**
 * Tags that head an object noun phrase: a determiner (`the`/`a`/`this`/…) or an
 * object pronoun (`it`/`them`/…) or a possessive (`your`/`his`/…). Used to detect
 * the imperative "VERB <object>" shape at sentence start, where the greedy
 * tagger has no left context and falls back to the noun/preposition prior.
 */
export function headsObjectPhrase(tag: string): boolean {
    return (
        tag === "DT" ||
        tag === "PDT" ||
        tag === "WDT" ||
        tag === "PRP$" ||
        tag === "PRP"
    );
}

/**
 * UPOS tags that are NOMINAL — they take FINAL stress in nominal-final-stress
 * languages (Persian nouns/adjectives). Verbs/function words are excluded
 * (verbs need prefix stress, deferred; clitics are unstressed).
 */
export function isNominalTag(tag: string): boolean {
    return tag === "NOUN" || tag === "PROPN" || tag === "ADJ" || tag === "NUM";
}

/**
 * UPOS tags that are VERBAL (Persian verb prefix-stress). Persian verbs
 * are stressed on the FIRST syllable of the whole form — the prefix می/نمی/بـ/نـ
 * when present, else the first stem syllable — with the personal ending
 * (-am/-i/-ad/-im/-id/-and) unstressed. AUX (auxiliary/copula) is included:
 * Persian compound/auxiliary verbs follow the same initial-stress pattern.
 */
export function isVerbalUpos(tag: string): boolean {
    return tag === "VERB" || tag === "AUX";
}

/** Serialized model artifact format (emitted by `tools/english/en_pos_train.ts`). */
export interface PosModel {
    scale: number;
    classes: string[];
    tagdict: Record<string, number>;
    weights: Record<string, Record<string, number>>; // feature -> classIdx -> intWeight
}

/** Greedy left-to-right averaged-perceptron tagger. */
export class PosTagger {
    private readonly classes: string[];
    private readonly tagdict: Record<string, number>;
    private readonly weights: Record<string, Record<string, number>>;

    constructor(model: PosModel) {
        this.classes = model.classes;
        this.tagdict = model.tagdict;
        this.weights = model.weights;
    }

    private predict(features: Record<string, number>): string {
        const scores = new Float64Array(this.classes.length);
        for (const feat in features) {
            const w = this.weights[feat];
            if (!w) continue;
            const val = features[feat] ?? 0;
            for (const idx in w) {
                const ci = +idx;
                scores[ci] = (scores[ci] ?? 0) + (w[idx] ?? 0) * val;
            }
        }
        let best = 0;
        let bestScore = scores[0] ?? 0;
        for (let k = 1; k < scores.length; k++) {
            // Deterministic argmax (ties broken toward the lexicographically smaller
            // class, matching the trainer's sorted `classes`).
            const s = scores[k] ?? 0;
            if (s > bestScore) {
                bestScore = s;
                best = k;
            }
        }
        return this.classes[best] ?? "NN";
    }

    /**
     * Tag a whole sentence's words; returns one PTB tag per word. Everything keys
     * off the NORMALIZED token (lowercased; years/digits folded) — the same form
     * the trainer uses for the tagdict and features — so train-time and run-time
     * agree regardless of the caller's casing (the phonemize tokenizer lowercases
     * words upstream, so the tagdict MUST be keyed on the normalized form or its
     * frequent-word fast path is dead).
     */
    tag(words: string[]): string[] {
        const norm = words.map(normalizeToken);
        const context = [START, START, ...norm, END, END];
        const tags: string[] = [];
        let prev = START;
        let prev2 = START;
        for (let i = 0; i < norm.length; i++) {
            const word = norm[i] ?? "";
            const cached = this.tagdict[word];
            const tag =
                cached !== undefined
                    ? (this.classes[cached] ?? "NN")
                    : this.predict(
                          extractFeatures(i, word, context, prev, prev2),
                      );
            tags.push(tag);
            prev2 = prev;
            prev = tag;
        }
        return tags;
    }
}
