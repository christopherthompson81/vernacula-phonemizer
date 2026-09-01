/**
 * Shared core for the per-position STRUCTURAL TAGGERS (bn bengaliTagger.ts, nb norwegianTagger.ts). A tagger is a
 * single BiLSTM forward pass emitting one IPA-chunk TAG per input symbol, decoded by a CONSONANT-CONSISTENCY MASK:
 * each symbol may only choose among the tags it produced in training, so the consonant skeleton is always canonical
 * and the model only picks the vowel/stress decoration. This module owns the three pieces both languages share so a
 * fix to any of them can't drift between them:
 *   1. the decode kernel — `maskedArgmax` (the mask + argmax invariant "cannot break the consonant skeleton");
 *   2. the word-level tagger — `createWordStructuralTagger` (lazy ONNX load + the per-word decode loop);
 *   3. the async serving pre-pass — `wordLevelNeuralPrepass` (tag each OOV word once, inject into the sync engine).
 * Each language still owns its language-specific bits via the options (bn: NFC preprocess; nb: lowercase+NFC preprocess
 * plus a single-primary-stress postprocess). fa's faTagger.ts and he's hebrewTagger.ts are a DIFFERENT (sentence-level,
 * UNK-permits-all) shape and intentionally do NOT use the word-level factory — but they DO still consume `maskedArgmax`
 * + `TaggerMeta` below, so a change to that decode kernel or the meta shape must keep those two compiling too.
 */
import { readData, readDataText } from "./dataSource.ts";
import { env } from "./env.ts";

import { loadOrt, type OrtLike, type OrtSession } from "./onnx.ts";

/** `src`: symbol → id (incl. `<pad>`=0, `<unk>`=1). `tags`: tag-id → IPA chunk. `charTags`: symbol-id → the tag-ids
 *  that symbol may emit (the consonant mask). Emitted by the train/export tools (export_tagger_onnx.py /
 *  export_bn_tagger_onnx.py / train_nb_bilstm.py). */
export interface TaggerMeta {
    src: Record<string, number>;
    tags: Record<string, string>;
    charTags: Record<string, number[]>;
}

/**
 * Argmax over ONLY the permitted tag ids for one position (the consonant mask) — a cheap scan of ~3 candidates
 * instead of all ~160 tags. `rowOffset` = position·nTags into the flat row-major `[T·nTags]` logits. Returns the
 * best tag id, or -1 when `valid` is empty/absent (the caller decides whether that means "decline the word").
 */
export function maskedArgmax(logits: Float32Array, rowOffset: number, valid: number[] | undefined): number {
    if (!valid || valid.length === 0) return -1;
    let best = valid[0]!, bestLo = logits[rowOffset + best]!;
    for (let j = 1; j < valid.length; j++) {
        const t = valid[j]!, v = logits[rowOffset + t]!;
        if (v > bestLo) {
            bestLo = v;
            best = t;
        }
    }
    return best;
}

/** The default vowel set for `oneStress`'s no-stress fallback — the union across the fleet's tagger languages
 *  (Norwegian + Danish add ə/ɐ/ɒ). Only consulted when a reading carries NEITHER a primary nor a secondary mark. */
const DEFAULT_STRESS_VOWEL = /[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]/u;

/**
 * Enforce EXACTLY ONE primary stress on a per-letter-tag concatenation. The tag alphabet embeds ˈ/ˌ but the
 * per-position argmax has no global stress constraint, so a raw reading can carry adjacent-doubled (`ˈˈ`/`ˌˌ`), zero,
 * or two primary marks. The lexicon and rule tiers both guarantee a single ˈ; this makes the tagger output
 * convention-consistent so the shipped OOV IPA never violates it. Keep the FIRST primary and drop later ones
 * (legitimate secondary ˌ are kept); if none survives, promote the first secondary, else place ˈ before the first
 * vowel's onset (the rule-engine default). `vowel` overrides the fallback vowel class for languages beyond the default.
 */
export function oneStress(ipa: string, vowel: RegExp = DEFAULT_STRESS_VOWEL): string {
    // collapse any run of adjacent stress marks to one (primary wins): ˈˈ / ˈˌ / ˌˈ → ˈ, ˌˌ → ˌ
    ipa = ipa.replace(/[ˈˌ]{2,}/gu, (m) => (m.includes("ˈ") ? "ˈ" : "ˌ"));
    let seen = false;
    ipa = ipa.replace(/ˈ/gu, () => (seen ? "" : ((seen = true), "ˈ"))); // keep the first ˈ, drop the rest
    if (seen) return ipa;
    if (ipa.includes("ˌ")) return ipa.replace("ˌ", "ˈ"); // no primary → promote the first secondary
    const m = vowel.exec(ipa); // still none → ˈ before the first vowel's onset (matches the rule engines)
    if (!m) return ipa;
    let onset = m.index;
    while (onset > 0 && !vowel.test(ipa[onset - 1]!)) onset--;
    return ipa.slice(0, onset) + "ˈ" + ipa.slice(onset);
}

/** A bare word → canonical IPA, or "" to defer to the rule engine (an out-of-vocab grapheme). */
export interface WordStructuralTagger {
    tag(word: string): Promise<string>;
}

export interface WordTaggerOptions {
    /** the calling module's data-directory KEY (`dataDir(import.meta.url)`) — model + meta live beside it */
    dir: string;
    /** meta filename stem; loads `${basename}.meta.json` */
    basename: string;
    /** the ONNX filename (varies: `nb-g2p-tagger.onnx`, `bn-g2p-tagger.int8.onnx`) */
    modelFile: string;
    /** loadOrt context string for the missing-dependency error (e.g. "Norwegian neural tagging") */
    context: string;
    /** env var naming an ONNX execution provider (e.g. "NB_ORT_EP"); CPU default when unset */
    epEnv: string;
    /** normalize a word to the training vocab (e.g. NFC, or lowercase+NFC) before it is split into graphemes */
    preprocess: (word: string) => string;
    /** optional final pass over the assembled IPA (e.g. nb's single-primary-stress normalizer); identity if absent */
    postprocess?: (ipa: string) => string;
}

/**
 * Build a word-level structural tagger from an ONNX model + its `TaggerMeta`, or `undefined` if the model /
 * onnxruntime-node is unavailable (callers fall back to their sync path; no throw). The `tag()` loop is the single
 * shared implementation: preprocess → decline on any out-of-vocab grapheme → one forward pass → masked argmax per
 * position → optional postprocess.
 */
export async function createWordStructuralTagger(opts: WordTaggerOptions): Promise<WordStructuralTagger | undefined> {
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readDataText(`${opts.dir}/${opts.basename}.meta.json`)) as TaggerMeta;
        modelBytes = readData(`${opts.dir}/${opts.modelFile}`);
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt(opts.context);
        // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) via the env var.
        const ep = env(opts.epEnv);
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;
    const post = opts.postprocess ?? ((s) => s);

    return {
        async tag(word: string): Promise<string> {
            const chars = [...opts.preprocess(word)];
            const T = chars.length;
            if (T === 0) return "";
            // DECLINE (return "") on any grapheme outside the training vocab: its symbol is not in the mask, so tagging
            // it would emit an arbitrary tag and override the correct rule reading. "" = "defer to the rule engine".
            const ids = new Array<number>(T);
            for (let i = 0; i < T; i++) {
                const id = meta.src[chars[i]!];
                if (id === undefined) return "";
                ids[i] = id;
            }
            const r = await sess.run({ chars: new ortLib.Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T * nTags], row-major (t·nTags + tag)
            let out = "";
            for (let k = 0; k < T; k++) {
                // Masked argmax over ONLY this symbol's permitted tags (the consonant mask, pad-excluded). A -1 (no
                // permitted tag) means decline the whole word → defer to rules.
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                if (best < 0) return "";
                out += meta.tags[String(best)] ?? "";
            }
            return post(out);
        },
    };
}

export interface NeuralPrepassOptions {
    /** GLOBAL word regex over the input text */
    word: RegExp;
    /** canonical form the sync engine's oovOverride is keyed by (e.g. lowercase); default: identity */
    key?: (word: string) => string;
    /** is this word (canonical form) served authoritatively by the sync lexicon — or otherwise
     *  outside the tagger's remit? → skip the tagger */
    lexHas: (word: string) => boolean;
    /** the tagger; "" means it declined (out-of-vocab grapheme) → leave the word to the rule engine */
    tag: (word: string) => Promise<string>;
    /** run the sync engine over the full text with the tagger readings injected as its per-word oovOverride */
    render: (text: string, oov: (word: string) => string | undefined) => string;
}

/**
 * The shared async neural serving pre-pass (bn, nb): tag each DISTINCT out-of-lexicon word ONCE, then run the ordinary
 * sync engine with those readings injected between the lexicon and the rule engine (lexicon → tagger → rules). Numbers,
 * punctuation, and clause assembly stay the sync engine's, so only OOV word readings change vs the plain sync path.
 */
export async function wordLevelNeuralPrepass(text: string, opts: NeuralPrepassOptions): Promise<string> {
    const key = opts.key ?? ((w: string): string => w);
    const tagged = new Map<string, string>();
    for (const m of text.matchAll(opts.word)) {
        const w = key(m[0]!);
        if (tagged.has(w) || opts.lexHas(w)) continue;
        const out = await opts.tag(w);
        if (out) tagged.set(w, out); // "" = declined → leave to the rule engine
    }
    return opts.render(text, (w) => tagged.get(w));
}
