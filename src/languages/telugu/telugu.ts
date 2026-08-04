/**
 * Native Telugu (te) text phonemizer — canonical IPA, espeak-independent. Telugu is a Dravidian Brahmic abugida
 * read by the generic engine (core/abugida.ts); unlike Hindi there is NO inherent-vowel deletion (every akshara
 * is pronounced — inherent /a/). telugu.ts adds only the light post-processing: geminate → length, and the
 * word-final anusvara ం realized as [m] (అంకురం → aŋkuɾam). First-syllable stress (weak; the backbone folds it).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { makeAbugidaG2P } from "../../core/abugida.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeTelugu } from "./normalize.ts";

const DEF = MANIFEST;
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
/**
 * Digits → IPA. The compositor is Telugu's OWN (numbers.ts), not the shared `indicNumberWords`: Telugu
 * orders 21-99 tens-first and INFLECTS its magnitude nouns for count and for a following remainder, and
 * the shared composer expresses neither — see the numbers.ts header for the corpus/audio evidence.
 */
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).split(" ").map(phonemizeWord).join(" ");
}

// The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
// diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
// engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix (#657).
const TOKEN = new RegExp(
    `([${TELUGU_WORD}]+)|(${LATIN_RUN})|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class TeluguPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // TEXT NORMALIZATION runs first, before tokenization — it is pure text→text (see normalize.ts).
        return assembleClauses(normalizeTelugu(input), TOKEN, (m, sink) => {
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
