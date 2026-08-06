/**
 * Native Kannada (kn) text phonemizer — canonical IPA. Kannada is a Dravidian Brahmic abugida
 * read by the generic engine (core/abugida.ts), mirroring Telugu: unlike Hindi there is NO inherent-vowel
 * deletion (every akshara is pronounced — inherent /a/). kannada.ts adds only the light post-processing:
 * geminate → length, ಳ್ಳ → [ɭː], and the word-final anusvara ಂ realized as [m]. First-syllable (weak) stress.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { makeAbugidaG2P } from "../../core/abugida.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeKannada } from "./normalize.ts";

const DEF = MANIFEST;
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
/**
 * Digits → IPA. The compositor is Kannada's OWN (numbers.ts), not the shared `indicNumberWords`:
 * Kannada fuses 21-99 into one word, has suppletive round hundreds (ಇನ್ನೂರು, ಮುನ್ನೂರು, ಐನೂರು,
 * ಒಂಬೈನೂರು) and takes combining magnitude forms before a remainder (ನೂರಾ, ಸಾವಿರದ, ಲಕ್ಷದ). The shared
 * composer expresses the last two not at all — see the numbers.ts header for the evidence and counts.
 */
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).split(" ").map(phonemizeWord).join(" ");
}

// The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
// diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
// engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
const TOKEN = new RegExp(
    `([${KANNADA_WORD}]+)|(${LATIN_RUN})|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class KannadaPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // TEXT NORMALIZATION runs first, before tokenization — it is pure text→text (see normalize.ts).
        return assembleClauses(normalizeKannada(input), TOKEN, (m, sink) => {
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
