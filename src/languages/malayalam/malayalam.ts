/**
 * Native Malayalam (ml) text phonemizer — canonical IPA, espeak-independent. Malayalam is a Dravidian Brahmic
 * abugida read by the generic engine (core/abugida.ts), mirroring Telugu/Kannada: NO inherent-vowel deletion
 * (every akshara is pronounced — inherent /a/). malayalam.ts adds the Malayalam-specific handling the generic
 * engine can't know:
 *   - CHILLU letters (ൻ ർ ൺ ൽ ൾ ൿ) — pure coda consonants with no inherent vowel → expanded to base + virama.
 *   - SAMVRITOKARAM — a word-final chandrakkala (virama) is not silent but a half-close [ɨ] (നാല് → naːlɨ); the
 *     defining Malayalam feature. Distinguished from chillu-final words (which end in the chillu char, not ്).
 *   - word-final anusvara ം → [m]; geminate → length; ള്ള → [ɭː]; first-syllable (weak) stress.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeMalayalam } from "./normalize.ts";
import { numberToWords } from "./numbers.ts";

const DEF = MANIFEST;
const CLAUSE_MARK = DEF.clausePunctuation;
const MALAYALAM_WORD = "ഀ-ൿ"; // Malayalam block (digits handled separately)
const MALAYALAM_DIGITS: Record<string, string> = {
    "൦": "0", "൧": "1", "൨": "2", "൩": "3", "൪": "4",
    "൫": "5", "൬": "6", "൭": "7", "൮": "8", "൯": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(MALAYALAM_DIGITS).join("");
const VOWEL = "aeiouɨ"; // vowel nuclei for the stress scan (NOT ɾ — a word-onset ര is not a nucleus)
const VIRAMA = "്"; // chandrakkala

// Chillu (pure-consonant) letters → their base consonant + virama, so the engine reads them as bare codas.
const CHILLU: Record<string, string> = {
    "ൺ": "ണ" + VIRAMA, // ɳ
    "ൻ": "ന" + VIRAMA, // n
    "ർ": "ര" + VIRAMA, // ɾ
    "ൽ": "ല" + VIRAMA, // l
    "ൾ": "ള" + VIRAMA, // ɭ
    "ൿ": "ക" + VIRAMA, // k
    "ൔ": "ന" + VIRAMA, "ൕ": "ല" + VIRAMA, "ൖ": "ന" + VIRAMA, // rare historic chillus
};
const CHILLU_RE = new RegExp(`[${Object.keys(CHILLU).join("")}]`, "gu");

let G2P: ((w: string) => string) | undefined;
function g2p(w: string): string {
    return (G2P ??= makeAbugidaG2P(DEF, loadSharedPhonology()))(w);
}

// Voiceless plosive/affricate → its voiced counterpart (the intervocalic/post-nasal sonorization rule).
const VOICE: Record<string, string> = { "k": "ɡ", "t̪": "d̪", "ʈ": "ɖ", "t͡ʃ": "d͡ʒ", "p": "b" };

// Geminate consonant (doubled base, possibly aspirated) → single + length ː.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\1(?!͡)/gu;

/** One Malayalam word → canonical IPA. */
export function phonemizeWord(word: string): string {
    let norm = word.normalize("NFC");
    // SAMVRITOKARAM: a word-final chandrakkala is a half-close [ɨ], not a silent virama (detected BEFORE chillu
    // expansion — chillu-final words end in the chillu char, not in ്, so they correctly do NOT get the [ɨ]).
    const samvrit = norm.endsWith(VIRAMA);
    norm = norm.replace(CHILLU_RE, (c) => CHILLU[c]!);
    // Anusvara ം → [m] word-finally AND before a non-stop (sibilant/ഹ/sonorant): അംശം→amʃam. Before a STOP it
    // stays for the engine's homorganic-nasal assimilation (അംഗം→aŋɡam). Both → base-m + virama = a bare [m].
    norm = norm.replace(/ം(?=[ശഷസഹയരറലവഴള]|$)/gu, "മ" + VIRAMA);
    let x = g2p(norm);
    x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
    x = x.replace(/ɭl/gu, "ɭː"); // ള്ള → geminate retroflex [ɭː]
    // INTERVOCALIC VOICING (the Dravidian sonorization rule): a SINGLE plosive/affricate voices between vowels
    // (അടി→aɖi, കറുക→karuɡa). Geminates (now Cː) and word-initial stops stay voiceless — the length ː after a
    // geminate blocks the following-vowel lookahead. Applied BEFORE the samvritokaram [ɨ] is appended, so a
    // word-final stop (historically utterance-final) stays voiceless (അതത്→ad̪at̪ɨ, NOT ad̪ad̪ɨ).
    x = x.replace(/(?<=[aeiouɨɐ̃ː])(k|t̪|ʈ|t͡ʃ|p)(?=[aeiouɨɐ])/gu, (c) => VOICE[c]!);
    // POST-NASAL voicing is scoped to the RETROFLEX cluster only: ണ്ട ɳʈ → ɳɖ (both referees ~90% voiced, even
    // before samvrit: പണ്ട്→paɳɖɨ). The other nasal+stop clusters (മ്പ mp, ന്ത nt̪, ങ്ക ŋk) are voiceless-dominant
    // in Sanskrit loans and are NOT voiced. Aspirated ɳʈʰ and the geminate ɳʈː are left as-is.
    x = x.replace(/ɳʈ(?![ʰː])/gu, "ɳɖ");
    if (samvrit) x += "ɨ";
    // First-syllable (weak) stress: mark the first vowel nucleus.
    const m = new RegExp(`[${VOWEL}]`, "u").exec(x);
    if (m && m.index !== undefined) x = x.slice(0, m.index) + "ˈ" + x.slice(m.index);
    return x.normalize("NFC");
}

const toAscii = (d: string): string =>
    [...d].map((c) => MALAYALAM_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const n = Number(toAscii(digits));
    if (!Number.isSafeInteger(n)) return digits;
    // The SHARED Dravidian composer (core/numbers.ts) via numbers.ts — not `indicNumberWords`, which
    // cannot express the fused 21-99, the suppletive hundreds/thousands or the combining magnitude.
    return numberToWords(n).split(" ").map(phonemizeWord).join(" ");
}

const TOKEN = new RegExp(
    `([${MALAYALAM_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+)|([।॥.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class MalayalamPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Fold this script's own digits to ASCII first: the number token is `\d+`, which JavaScript
        // defines as ASCII-only, so a numeral written in native digits matched NO token and was
        // dropped entirely — the engine returned an empty string for it (core/unicode.ts).
        // normalize.ts runs FIRST: it maps the legacy ZWJ chillu spellings, removes the ZWNJ that was
        // splitting words in two, and rewrites numerals, clitics, symbols, times and decimals into
        // words this tokenizer already speaks (see the ordering notes there).
        return assembleClauses(foldNativeDigits(normalizeMalayalam(input)), TOKEN, (m, sink) => {
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

/** Build the Malayalam phonemizer. `foreign` handles embedded Latin runs. */
export function createMalayalam(foreign?: ForeignPhonemizer): Phonemizer {
    return new MalayalamPhonemizer(foreign);
}
