/**
 * Azerbaijani (az) phonemizer — North Azerbaijani (Latin), canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts) + final-syllable stress (the Turkic default). text() tokenizes words / numbers / punctuation. See
 * docs/investigations/az_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Phonemize a single Azerbaijani word to canonical IPA (final-syllable stress, before the stressed vowel). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    const stressIdx = nuclei[nuclei.length - 1]!; // final-syllable default
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Azerbaijani letters), a number, or clause punctuation. Azerbaijani uses . as thousands sep, , as decimal.
const TOKEN = /([a-zçğəıiöşüx]+)|(\d+(?:\.\d{3})*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (Azerbaijani thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
    if (frac !== undefined)
        words +=
            ` ${MANIFEST.numbers.decimalConnector} ` +
            [...frac].map((d) => numberToWords(Number(d))).join(" ");
    return words;
}

class AzerbaijaniPhonemizer implements Phonemizer {
    text(input: string): string {
        // Normalise the Azerbaijani dotted-I pair BEFORE tokenizing: capital İ (U+0130) has no Unicode simple
        // case-fold to i, so the /i/-flag TOKEN class would silently DROP it (İki → ki). Map İ→i and I→ı up front
        // (azLower does the same per-token, but the tokenizer must see the lowercase forms to match at all).
        const normalized = input.replace(/İ/gu, "i").replace(/I/gu, "ı");
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberTokenToWords(m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Azerbaijani phonemizer (rule g2p + final-syllable stress). */
export function createAzerbaijani(): Phonemizer {
    return new AzerbaijaniPhonemizer();
}
