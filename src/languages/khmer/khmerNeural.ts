/**
 * Async neural entry for Khmer (km) — restores the WORD BOUNDARIES Khmer does not write, then hands the text to
 * the unchanged sync engine.
 *
 * WHY THIS IS A SEPARATE ASYNC PATH RATHER THAN A CHANGE TO `khmer.ts`. Segmentation moves every reading in the
 * language: the tokeniser currently takes a maximal Khmer run as one unit, and splitting it changes which entries
 * of the pronunciation lexicon hit and how the syllabifier parses. That is not a change to make silently, and
 * `segment.ts` already records the judgement that it needs a referee pass to justify. As the async tier it costs
 * the sync engine nothing: `phonemize` behaves exactly as before, `phonemizeAsync` reads better Khmer, and every
 * existing test keeps passing untouched. Same shape as Hebrew's nakdan (restore what the script omits, then read).
 *
 * WHAT IT BUYS. On 4,000 junctions where a Khmer writer actually typed U+200B, joining the two words corrupts the
 * reading 54.6% of the time — `នៅ|សតវត្ស` → *nɨwhtɑʋɑt* against *nɨw + sɑtɑʋoət*, a coda stolen and a syllable
 * lost. Restoring the boundary restores the reading.
 *
 * When `onnxruntime-node` or the model is absent this IS the sync path — no throw, no degradation.
 * See km-segmenter.PROVENANCE.md.
 */
import { createKhmer } from "./khmer.ts";
import { createKhmerSegmenter, type KhmerSegmenter } from "./khmerSegmenter.ts";

let segmenterP: Promise<KhmerSegmenter | undefined> | undefined;
/** BiLSTM boundaries supplied here, so the engine must NOT add the perceptron's on top. */
let unsegmented: ReturnType<typeof createKhmer> | undefined;
/** ⚠ The FALLBACK engine still segments. Without the BiLSTM this path must degrade to the ordinary sync path —
 *  which restores boundaries with the perceptron — not to the unsegmented reading that predates both models. */
let segmenting: ReturnType<typeof createKhmer> | undefined;

/** Phonemize Khmer text, restoring word boundaries with the neural tagger before the sync engine reads it. */
export async function phonemizeKmNeural(text: string): Promise<string> {
    if (segmenterP === undefined) segmenterP = createKhmerSegmenter();
    const segmenter = await segmenterP;
    if (!segmenter) {
        // No BiLSTM → the ordinary sync path, perceptron boundaries and all (end-to-end 76.7% against the
        // BiLSTM's 80.4%). Falling back to `segment: false` here would silently be the WORST of the three.
        segmenting ??= createKhmer();
        return segmenting.text(text);
    }
    // segment: false — this path supplies its own (better) boundaries; see createKhmer's note.
    unsegmented ??= createKhmer({ segment: false });
    // The segmenter inserts U+200B, which `khmer.ts`'s TOKEN already treats as a run break, so the sync engine
    // needs no knowledge of this path at all.
    return unsegmented.text(await segmenter.restore(text));
}
