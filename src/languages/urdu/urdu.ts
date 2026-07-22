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
import { HARAKAT } from "../../core/harakatLexicon.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
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

// COVERAGE layer: an undiacritized skeleton whose vocalization we've mined is looked up here and returned as
// canonical IPA DIRECTLY, short-circuiting the g2p's default-schwa guess. Urdu stores IPA (not harakat) because
// harakat can't encode the majhūl ی=iː~eː / و=oː~uː distinction the cross-script Hindi gold provides; see
// tools/arabic-restorer/build_ur_ipa_lexicon.ts. Entries are UNSTRESSED (weight-stress applied at lookup).
// Loaded LAZILY (registry.ts imports every rider eagerly; the TSV is only read on first Urdu use).
let LEXICON: ReadonlyMap<string, string> | undefined;
function ipaLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadTsvMap(import.meta.url, "lexicon-ipa.tsv", undefined, { optional: true }));
}
/** The coverage lexicon's key set (covered skeletons), for the neural rider pre-pass to leave covered words bare. */
export function coverageLexicon(): ReadonlyMap<string, string> {
    return ipaLexicon();
}

/**
 * Post-g2p canonicalisation (UNSTRESSED): turn raw g2p output into final canonical IPA. Shared by the core and the
 * IPA-lexicon BUILDER (tools/arabic-restorer/build_ur_ipa_lexicon.ts) so a stored lexicon value is byte-identical to
 * what the core would emit — the lexicon short-circuit then only needs weight-stress, not this whole tail.
 *   - deleteMedialSchwa: the g2p inserts a default [ə] for every unwritten short vowel; Urdu (like Hindi) DELETES it
 *     in a medial V·C·ə·C·V context so clusters surface bare (پاکستان → pɑːkst̪ɑːn). Explicit vowels are marked with
 *     ̲ and survive.
 *   - strip ̲ (U+0332): the explicit-fatḥa protection mark is an internal marker, never part of the output.
 *   - nasal PLACE assimilation: /n/ → [m] before a labial (b/p), [ŋ] before a velar (k/ɡ) — انبار→əmbɑːɾ, انگور→əŋɡuːɾ.
 */
export function finalizeUrduIpa(ipa: string): string {
    return deleteMedialSchwa(ipa)
        .replace(/̲/gu, "")
        .replace(/n(?=[bp])/gu, "m")
        .replace(/n(?=[kɡ])/gu, "ŋ");
}

/** Lexicon-FREE core: g2p + finalize + weight stress. Used by the number path and the mining tool, which must NOT
 *  consult the content lexicon (number words / mining candidates would collide with content homographs).
 *  NOTE: word-final ـیہ (ی+ہ) is deliberately NOT rewritten — the ending is genuinely ambiguous (feminine -iyya
 *  حاشیہ→[jɑ] vs masculine Arabic -īh فقیہ→[iːh]) with no orthographic signal, so it is a per-word lexicon matter. */
export function phonemizeWordCore(word: string): string {
    const ipa = g2p(word);
    if (!ipa) return "";
    return applyWeightStress(finalizeUrduIpa(ipa)).normalize("NFC");
}

/** One Urdu word → canonical IPA. If the writer supplied harakat, respect it (g2p reads the explicit vowels);
 *  else consult the IPA coverage lexicon (short-circuit straight to canonical IPA + weight-stress); else the
 *  lexicon-free default-schwa core. */
export function phonemizeWord(word: string): string {
    if (!HARAKAT.test(word)) {
        const ipa = ipaLexicon().get(word.normalize("NFC"));
        if (ipa) return applyWeightStress(ipa).normalize("NFC");
    }
    return phonemizeWordCore(word);
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
