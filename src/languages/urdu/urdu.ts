/**
 * Native Urdu (ur) text phonemizer — canonical IPA, espeak-independent. Urdu = Hindi phonology in the
 * Perso-Arabic abjad; the g2p (g2p.ts) does the script→IPA mapping, this file layers weight-based stress
 * (shared with Hindi), numbers, clause punctuation, and embedded-Latin routing. Short-vowel restoration for
 * undiacritized text is DEFERRED (the g2p inserts a default [ə]); see docs/investigations/ur_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadHarakatLexicon, restoreHarakat } from "../../core/harakatLexicon.ts";
import { phonemizeWord as g2p } from "./g2p.ts";

interface UrduTextDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<UrduTextDef>(import.meta.url, "urdu.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

// Urdu uses ASCII 0-9 and the Perso-Arabic (Eastern Arabic) digits ۰-۹.
const EASTERN_DIGITS: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(EASTERN_DIGITS).join("");
// Arabic-script word range (U+0600–06FF + U+0750–077F extensions), excluding the digits/punctuation handled below.
const URDU_WORD = "ء-ٟٮ-ۓە-ۜ۞-ۿ";

// COVERAGE layer: an undiacritized skeleton whose short vowels we've mined is looked up here and vocalized
// before g2p, so the g2p reads the real ɪ/ʊ instead of a default schwa (see core/harakatLexicon.ts). Loaded
// LAZILY (registry.ts imports every rider eagerly; the ~2.6k-line TSV is only read on first Urdu use).
let LEXICON: ReadonlyMap<string, string> | undefined;
export function harakatLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadHarakatLexicon(import.meta.url));
}

/** Lexicon-FREE core: g2p + default-schwa deletion + weight stress. Used by the number path and the mining tool,
 *  which must NOT consult the content lexicon (number words / mining candidates would collide with content homographs). */
export function phonemizeWordCore(word: string): string {
    let ipa = g2p(word);
    if (!ipa) return "";
    // The g2p inserts a default [ə] for every unwritten short vowel; Urdu (like Hindi) then DELETES the schwa
    // in a medial V·C·ə·C·V context, so consonant clusters surface bare (پاکستان → pɑːkɪst̪ɑːn-skeleton pɑːkst̪ɑːn,
    // not pɑːkəsət̪ɑːn). The correct ɪ/ʊ quality needs the deferred restoration layer; the STRUCTURE is right.
    ipa = deleteMedialSchwa(ipa);
    ipa = ipa.replace(/̲/gu, ""); // strip the explicit-fatḥa protection mark (see g2p.ts) — deletion is done
    // Nasal PLACE assimilation: /n/ → [m] before a labial (b/p), [ŋ] before a velar (k/ɡ) — انبار→əmbɑːɾ,
    // انگور→əŋɡuːɾ. Standard Hindustani (and matches the referee).
    ipa = ipa.replace(/n(?=[bp])/gu, "m").replace(/n(?=[kɡ])/gu, "ŋ");
    // NOTE: word-final ـیہ (ی+ہ) is NOT rewritten here — the ending is genuinely ambiguous (feminine -iyya حاشیہ→[jɑ]
    // vs masculine Arabic -īh فقیہ→[iːh]), identical in spelling with no orthographic signal, so a blanket rule
    // corrupts common loanwords. It is a per-word restoration/lexicon matter. See docs/investigations/ur_convergence_investigation.md.
    return applyWeightStress(ipa).normalize("NFC");
}

/** One Urdu word → canonical IPA (coverage-lexicon restore + the lexicon-free core). */
export function phonemizeWord(word: string): string {
    return phonemizeWordCore(restoreHarakat(word, harakatLexicon()));
}

const TOKEN = new RegExp(
    `([${URDU_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+(?:[.,][${DIGIT_CLASS}]+)?)|([۔؟،؛.?!,;:])`,
    "gu",
);

const toAscii = (d: string): string =>
    [...d].filter((c) => c !== ",").map((c) => EASTERN_DIGITS[c] ?? c).join("");

function number(digits: string): string {
    const ascii = toAscii(digits);
    const n = Number(ascii);
    if (!Number.isSafeInteger(n)) return ascii;
    return renderNumber(n, DEF.numbers, phonemizeWordCore); // numbers bypass the content lexicon
}

class UrduPhonemizer implements Phonemizer {
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

/** Build the Urdu phonemizer. `foreign` handles embedded Latin runs. */
export function createUrdu(foreign?: ForeignPhonemizer): Phonemizer {
    return new UrduPhonemizer(foreign);
}
