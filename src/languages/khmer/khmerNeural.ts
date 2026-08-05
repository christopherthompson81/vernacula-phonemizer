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
let sync: ReturnType<typeof createKhmer> | undefined;

/** Phonemize Khmer text, restoring word boundaries with the neural tagger before the sync engine reads it. */
export async function phonemizeKmNeural(text: string): Promise<string> {
    sync ??= createKhmer();
    if (segmenterP === undefined) segmenterP = createKhmerSegmenter();
    const segmenter = await segmenterP;
    if (!segmenter) return sync.text(text); // no model → today's sync behaviour, unchanged
    // The segmenter inserts U+200B, which `khmer.ts`'s TOKEN already treats as a run break, so the sync engine
    // needs no knowledge of this path at all.
    return sync.text(await segmenter.restore(text));
}
