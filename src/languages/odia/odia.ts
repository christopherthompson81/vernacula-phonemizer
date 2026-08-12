/**
 * Native Odia / ଓଡ଼ିଆ (or) text phonemizer — canonical IPA. Odia is an Eastern Indo-Aryan
 * Brahmic abugida read by the generic engine (core/abugida.ts), like the Dravidian trio (Telugu/Kannada/Malayalam):
 * NO inherent-vowel deletion — every akshara is pronounced, and the inherent vowel is /ɔ/ (ଘର→ɡʱɔɾɔ), like Bengali.
 * odia.ts adds only the light post-processing: geminate → length, ଳ୍ଳ → [ɭː], and
 * first-syllable (weak) stress. No intervocalic voicing (Indo-Aryan, unlike the Dravidian trio).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { foldNativeDigits } from "../../core/unicode.ts";
import { makeOdiaNormalizer } from "./normalize.ts";

interface OdiaDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OdiaDef>(import.meta.url, "odia.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const ODIA_WORD = "଀-୥୰-୷"; // Odia block EXCLUDING the digits ୦-୯ (U+0B66–0B6F, matched by the digit branch)
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
    // Anusvara ଂ nasalizes the vowel in ALL positions in Odia — including word-finally (ଏବଂ→ebɔ̃, NOT ebɔm;
    // unlike Kannada's final ಂ→[m]) — so the engine's nasalizeVowel handles it directly, no override.
    const norm = word.normalize("NFC");
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
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(toAscii(digits), DEF.numbers, phonemizeWord);
    return renderNumber(n, DEF.numbers, phonemizeWord);
}

const TOKEN = new RegExp(
        // ⚠ ALL OF LATIN, not just ASCII: `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it
    // became an unclaimed gap read as an English LETTER NAME and the rest of the word started over —
    // `São Paulo` read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ*, "ES ə O Paulo". This group already means FOREIGN (its match goes
    // to the injected reader), so widening it is the whole fix. Same change as the shared abugida tokenizer.
    `([${ODIA_WORD}]+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

const normalize = makeOdiaNormalizer(DEF.numbers);

class OdiaPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // NATIVE DIGITS FIRST: the corpus writes ୦-୯ (52 of them), and every pattern in normalize.ts is
        // written against ASCII digits. `number()` folds them for the bare-numeral path anyway, so this
        // changes no reading — it only lets the normalization rules see them. See normalize.ts's header.
        return assembleClauses(normalize(foldNativeDigits(input)), TOKEN, (m, sink) => {
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
