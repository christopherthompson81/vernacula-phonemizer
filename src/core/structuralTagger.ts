/**
 * Shared core for the per-position STRUCTURAL TAGGERS (fa faTagger.ts, bn bengaliTagger.ts). Both are a single
 * BiLSTM forward pass emitting one IPA-chunk TAG per input symbol, decoded by a CONSONANT-CONSISTENCY MASK: each
 * symbol may only choose among the tags it produced in training, so the consonant skeleton is always canonical and
 * the model only picks the vowel decoration. The mask + argmax are the load-bearing invariant both files advertise
 * ("cannot break the consonant skeleton"); keeping the decode kernel here means a fix to it can't drift between the
 * two languages. Each tagger still owns its language-specific assembly (fa: space→word split + first-vowel fix;
 * bn: NFC + decline on out-of-vocab grapheme).
 */

/** `src`: symbol → id (incl. `<pad>`=0, `<unk>`=1). `tags`: tag-id → IPA chunk. `charTags`: symbol-id → the tag-ids
 *  that symbol may emit (the consonant mask). Emitted by the train/export tools (export_tagger_onnx.py /
 *  export_bn_tagger_onnx.py). */
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
