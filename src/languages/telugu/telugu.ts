/**
 * Native Telugu (te) text phonemizer — canonical IPA, espeak-independent. Telugu is a Dravidian Brahmic abugida
 * read by the generic engine (core/abugida.ts); unlike Hindi there is NO inherent-vowel deletion (every akshara
 * is pronounced — inherent /a/). telugu.ts adds only the light post-processing: geminate → length, and the
 * word-final anusvara ం realized as [m] (అంకురం → aŋkuɾam). First-syllable stress (weak; the backbone folds it).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface TeluguDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TeluguDef>(import.meta.url, "telugu.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const TELUGU_WORD = "ఀ-౯ౠ-ౣ";
const TELUGU_DIGITS: Record<string, string> = {
    "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4",
    "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(TELUGU_DIGITS).join("");
const VOWEL = "aeiouɾ"; // nucleus starts (for the geminate/stress scan; ɾ only in the ɾu vocalic-r nucleus)

let G2P: ((w: string) => string) | undefined;
function g2p(w: string): string {
    return (G2P ??= makeAbugidaG2P(DEF, loadSharedPhonology()))(w);
}

// Geminate consonant (doubled base, possibly aspirated) → single + length ː.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t͡s|d͡z|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦʋɾr])\1(?!͡)/gu;

/** One Telugu word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Word-final anusvara ం → [m] (అంకురం→aŋkuɾam); medial ం is a homorganic nasal, handled by the engine.
    const norm = word.normalize("NFC").replace(/ం$/u, "మ్");
    let x = g2p(norm);
    x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
    x = x.replace(/ɭl/gu, "ɭː"); // ళ్ల → geminate retroflex [ɭː] (కోళ్లు→koːɭːu)
    // First-syllable (weak) stress: mark the first vowel nucleus.
    const m = new RegExp(`[${VOWEL}]`, "u").exec(x);
    if (m && m.index !== undefined) x = x.slice(0, m.index) + "ˈ" + x.slice(m.index);
    return x.normalize("NFC");
}

const toAscii = (d: string): string =>
    [...d].map((c) => TELUGU_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord);
}

const TOKEN = new RegExp(
    `([${TELUGU_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class TeluguPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Telugu phonemizer. `foreign` handles embedded Latin runs. */
export function createTelugu(foreign?: ForeignPhonemizer): Phonemizer {
    return new TeluguPhonemizer(foreign);
}
