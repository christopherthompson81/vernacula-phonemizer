/**
 * Async neural entry for Hebrew (he) — the PHASE-2 path that reads everyday UNVOCALIZED Hebrew. It routes each
 * word: a word that already carries niqqud is phonemized DETERMINISTICALLY by the Phase-1 g2p (hebrew.ts); a bare
 * consonantal word is restored by the neural tagger (hebrewTagger.ts, a per-consonant BiLSTM that emits IPA
 * directly and cannot degenerate). Numbers, punctuation, and clause assembly are the sync engine's, so the output
 * is byte-identical to `phonemize(text,"he")` except that bare words now get restored vowels instead of a bare
 * consonant skeleton.
 *
 * Integration is a pre-pass: tag each distinct bare word, then run the sync `createHebrew().text()` with those
 * readings injected as its per-call `oovOverride`. When `onnxruntime-node` or the model is absent the tagger is
 * `undefined` and this returns exactly the sync (Phase-1) path (no throw). Separate async path; the sync engine and
 * its tests are untouched. See src/languages/hebrew/he-tagger.PROVENANCE.md.
 */
import { createHebrew } from "./languages/hebrew/hebrew.ts";
import { createHebrewTagger, type HebrewTagger } from "./languages/hebrew/hebrewTagger.ts";

const WORD = /[א-ת][א-ת־']*/gu;      // a Hebrew word token (letters + maqaf/geresh)
const NIQQUD = /[ְ-ׇ]/u;    // any Hebrew point → the word is already vocalized (use Phase 1)
let taggerP: Promise<HebrewTagger | undefined> | undefined;
let engine: ReturnType<typeof createHebrew> | undefined;
const heEngine = (): ReturnType<typeof createHebrew> => (engine ??= createHebrew());

/**
 * Phonemize Hebrew text with the neural tagger restoring the vowels of UNVOCALIZED words. Async because the ONNX
 * pass is; falls back to the sync Phase-1 path (which only voices vocalized input) when the model / onnxruntime-node
 * is unavailable.
 */
export async function phonemizeHebrewNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createHebrewTagger();
    const tagger = await taggerP;
    if (!tagger) return heEngine().text(text); // no model → sync Phase-1 path

    // PRE-PASS: restore each distinct BARE (unvocalized) word once. Vocalized words are left to the deterministic
    // Phase-1 g2p (the tagger would decline on their niqqud chars anyway). An empty tagger result → defer to Phase 1.
    const tagged = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        if (tagged.has(w) || NIQQUD.test(w)) continue;
        const out = await tagger.tag(w);
        if (out) tagged.set(w, out);
    }
    // Run the sync engine with the tagger readings injected; vocalized words + numbers + punctuation are unchanged.
    return heEngine().text(text, (w) => tagged.get(w));
}
