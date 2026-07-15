/**
 * Native Kannada (kn) text phonemizer — canonical IPA, espeak-independent. Kannada is a Dravidian Brahmic abugida
 * read by the generic engine (core/abugida.ts), mirroring Telugu: unlike Hindi there is NO inherent-vowel
 * deletion (every akshara is pronounced — inherent /a/). kannada.ts adds only the light post-processing:
 * geminate → length, ಳ್ಳ → [ɭː], and the word-final anusvara ಂ realized as [m]. First-syllable (weak) stress.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface KannadaDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<KannadaDef>(import.meta.url, "kannada.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const KANNADA_WORD = "ಀ-೥೰-೿"; // Kannada block minus the digit range
const KANNADA_DIGITS: Record<string, string> = {
    "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4",
    "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(KANNADA_DIGITS).join("");
const VOWEL = "aeiouɾ";

let G2P: ((w: string) => string) | undefined;
function g2p(w: string): string {
    return (G2P ??= makeAbugidaG2P(DEF, loadSharedPhonology()))(w);
}

// Geminate consonant (doubled base, possibly aspirated) → single + length ː.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\1(?!͡)/gu;

/** One Kannada word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Word-final anusvara ಂ → [m]; medial ಂ is a homorganic nasal, handled by the engine.
    const norm = word.normalize("NFC").replace(/ಂ$/u, "ಮ್");
    let x = g2p(norm);
    x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
    x = x.replace(/ɭl/gu, "ɭː"); // ಳ್ಳ → geminate retroflex [ɭː]
    // First-syllable (weak) stress: mark the first vowel nucleus.
    const m = new RegExp(`[${VOWEL}]`, "u").exec(x);
    if (m && m.index !== undefined) x = x.slice(0, m.index) + "ˈ" + x.slice(m.index);
    return x.normalize("NFC");
}

const toAscii = (d: string): string =>
    [...d].map((c) => KANNADA_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord);
}

const TOKEN = new RegExp(
    `([${KANNADA_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class KannadaPhonemizer implements Phonemizer {
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

/** Build the Kannada phonemizer. `foreign` handles embedded Latin runs. */
export function createKannada(foreign?: ForeignPhonemizer): Phonemizer {
    return new KannadaPhonemizer(foreign);
}
