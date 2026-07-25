/**
 * Async neural entry for Norwegian Bokmål (nb). Runs the per-grapheme STRUCTURAL TAGGER (norwegianTagger.ts, a
 * BiLSTM, ONNX) over the OOV words — those the NST pronunciation lexicon (nb-lexicon.tsv) misses — and leaves
 * everything else to the SYNC engine. Precedence is lexicon → tagger → rule engine: the tagger's whole-word
 * bidirectional pass predicts stress POSITION + the stress-conditioned vowel quality directly from spelling (the
 * deep-orthography contrast the sync first-syllable rule heuristic can't recover), and because it emits one IPA-chunk
 * per grapheme it CANNOT degenerate or break the consonant skeleton.
 *
 * Integration is a pre-pass: resolve each OOV word to IPA with the tagger, then run the ordinary sync
 * `createNorwegian().text()` with those readings injected as its `oovOverride`. So the tokenizer, number path, and
 * clause/pause assembly are the SYNC engine's, byte-identical to `phonemize(text, "nb")` — ONLY the OOV word readings
 * change. When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns exactly the sync
 * path (no throw). This is a SEPARATE async path; the sync engine is untouched.
 */
import { createNorwegian, norwegianLexicon } from "./languages/norwegian/norwegian.ts";
import { createNorwegianTagger, type NorwegianTagger } from "./languages/norwegian/norwegianTagger.ts";

const WORD = /[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]+/gu;
let taggerP: Promise<NorwegianTagger | undefined> | undefined;
// One built engine, reused across calls (like the sync path's singleton — no per-call rebuild).
let engine: ReturnType<typeof createNorwegian> | undefined;
const nbEngine = (): ReturnType<typeof createNorwegian> => (engine ??= createNorwegian());

/**
 * Phonemize Norwegian text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (lexicon + rule engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeNbNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createNorwegianTagger();
    const tagger = await taggerP;
    if (!tagger) return nbEngine().text(text); // no model → sync path

    // PRE-PASS: tag every distinct OOV word once (lexicon-covered words are served by the sync lexicon path, so skip
    // them). The tagger emits final IPA (with stress) directly; an empty result means it DECLINED (an out-of-vocab
    // grapheme) — leave the word out of the map so the sync rule engine handles it.
    const lex = norwegianLexicon();
    const tagged = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        if (tagged.has(w) || lex.has(w.toLowerCase())) continue;
        const out = await tagger.tag(w);
        if (out) tagged.set(w, out);
    }
    // Run the SYNC engine with the tagger readings injected between lexicon and rules — everything else (numbers,
    // punctuation, clause assembly) is the sync path, so only OOV word readings differ.
    return nbEngine().text(text, (w) => tagged.get(w));
}
