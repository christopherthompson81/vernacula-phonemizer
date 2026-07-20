/**
 * Async neural entry for Persian (fa) — the deploy wrapper that runs the OOV seq2seq vowel restorer
 * (languages/persian/vowelRestorer.ts, ONNX) for words the coverage lexicon misses, and the SYNC lexicon+g2p path
 * for everything else. Precedence: lexicon → neural → default. Unlike the rider harakat path (riderNeural.ts), the
 * seq2seq emits IPA DIRECTLY, so this assembles IPA itself rather than vocalising the abjad first.
 *
 * When the optional `onnxruntime-node` dep or the .onnx model is absent, the restorer is undefined and this
 * degrades to exactly the sync `phonemize(text, "fa")`. This is a SEPARATE async path — the sync engine (and its
 * C#-parity + referee-eval) is untouched. See docs/investigations/fa_shortvowel_restoration_investigation.md.
 */
import { assembleClauses } from "./core/clauses.ts";
import { getPhonemizer } from "./registry.ts";
import { stripHarakat } from "./core/harakatLexicon.ts";
import { createFaVowelRestorer, type FaVowelRestorer } from "./languages/persian/vowelRestorer.ts";
import { harakatLexicon, phonemizeWord } from "./languages/persian/persian.ts";

const PERSO = "ء-ۿݐ-ݿ‌‍";
const WORD = new RegExp(`[${PERSO}]+`, "gu");
const TOKEN = new RegExp(`([${PERSO}]+)|(\\d[\\d\\u06F0-\\u06F9]*)|([۔؟،؛.?!,;:])`, "gu");
const MARK: Record<string, string> = { "۔": ".", "؟": "?", "،": ",", "؛": ",", ".": ".", "?": "?", "!": "!", ",": ",", ";": ",", ":": "," };

let restorerP: Promise<FaVowelRestorer | undefined> | undefined;

/**
 * Phonemize Persian text with the neural OOV vowel restorer. Async because the ONNX pre-pass is; falls back to the
 * plain sync `phonemize(text, "fa")` when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeFaNeural(text: string): Promise<string> {
    if (restorerP === undefined) restorerP = createFaVowelRestorer();
    const restorer = await restorerP;
    if (!restorer) return getPhonemizer("fa").text(text); // no model → sync lexicon+default path

    const lex = harakatLexicon();
    // Pre-resolve the OOV words (lexicon-covered ones stay on the authoritative sync path) into an override map.
    const neural = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        // The seq2seq needs context — it is unreliable on 1–2 letter function words (و، به، او), which the
        // lexicon/g2p handles anyway. Neural only for lexicon-OOV words of ≥3 letters.
        if ([...w].length >= 3 && !lex.has(stripHarakat(w)) && !neural.has(w)) neural.set(w, await restorer.restore(w));
    }
    return assembleClauses(text, TOKEN, (m, sink) => {
        if (m[1]) sink.emit(neural.get(m[1]) ?? phonemizeWord(m[1])); // OOV → neural IPA; else sync lexicon/g2p
        else if (m[2]) sink.emit(getPhonemizer("fa").text(m[2])); // digits → the sync number path
        else if (m[3]) {
            const mk = MARK[m[3]];
            if (mk) sink.pause(mk);
        }
    });
}
