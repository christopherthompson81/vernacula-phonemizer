/**
 * Native Odia / ଓଡ଼ିଆ (or) text phonemizer — canonical IPA, espeak-independent. Odia is an Eastern Indo-Aryan
 * Brahmic abugida read by the generic engine (core/abugida.ts), like the Dravidian trio (Telugu/Kannada/Malayalam):
 * NO inherent-vowel deletion — every akshara is pronounced, and the inherent vowel is /ɔ/ (ଘର→ɡʱɔɾɔ), like Bengali.
 * odia.ts adds only the light post-processing: geminate → length, ଳ୍ଳ → [ɭː], the word-final anusvara ଂ → [m], and
 * first-syllable (weak) stress. No intervocalic voicing (Indo-Aryan, unlike the Dravidian trio).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface OdiaDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OdiaDef>(import.meta.url, "odia.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const ODIA_WORD = "଀-୯ୱ-୷"; // Odia block (digits handled separately, but kept in the word class for tokenizing)
const ODIA_DIGITS: Record<string, string> = {
    "୦": "0", "୧": "1", "୨": "2", "୩": "3", "୪": "4",
    "୫": "5", "୬": "6", "୭": "7", "୮": "8", "୯": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(ODIA_DIGITS).join("");
const VOWEL = "aeiouɔɾ";

let G2P: ((w: string) => string) | undefined;
function g2p(w: string): string {
    return (G2P ??= makeAbugidaG2P(DEF, loadSharedPhonology()))(w);
}

// Geminate consonant (doubled base, possibly aspirated) → single + length ː.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|n̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋwɾr])\1(?!͡)/gu;

/** One Odia word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Word-final anusvara ଂ → [m]; medial ଂ is a homorganic nasal, handled by the engine.
    const norm = word.normalize("NFC").replace(/ଂ$/u, "ମ୍");
    let x = g2p(norm);
    x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
    x = x.replace(/ɭl/gu, "ɭː"); // ଳ୍ଳ → geminate retroflex [ɭː]
    // First-syllable (weak) stress: mark the first vowel nucleus.
    const m = new RegExp(`[${VOWEL}]`, "u").exec(x);
    if (m && m.index !== undefined) x = x.slice(0, m.index) + "ˈ" + x.slice(m.index);
    return x.normalize("NFC");
}

const toAscii = (d: string): string =>
    [...d].map((c) => ODIA_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord);
}

const TOKEN = new RegExp(
    `([${ODIA_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class OdiaPhonemizer implements Phonemizer {
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

/** Build the Odia phonemizer. `foreign` handles embedded Latin runs. */
export function createOdia(foreign?: ForeignPhonemizer): Phonemizer {
    return new OdiaPhonemizer(foreign);
}
