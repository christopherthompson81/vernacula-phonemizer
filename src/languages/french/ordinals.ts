/**
 * French (fr) ORDINALS — formation from any integer, plus the two written forms that reach the engine:
 * digit notation (`1er`, `1re`, `37e`, `2ème`) and the Roman-numeral century (`XVIIe siècle`).
 *
 * Formation is regular and needs no table beyond the cardinals: an ordinal is the cardinal plus `-ième`,
 * with four adjustments, all of which are the standard statements (Grevisse, *Le Bon Usage* §581–583):
 *   1. a final ⟨e⟩ is dropped before the suffix — quatre → quatrième, onze → onzième, mille → millième;
 *   2. cinq takes an epenthetic ⟨u⟩ — cinquième (keeps [k] before the front vowel);
 *   3. neuf voices its final — neuvième;
 *   4. the plural ⟨s⟩ of vingts / cents / millions is dropped — quatre-vingts → quatre-vingtième.
 * Only the FINAL element of a compound inflects (cent trente-sept → cent trente-septième), and 1 is
 * suppletive: premier / première standalone, but unième inside a compound (vingt-et-unième).
 *
 * ⚠ A FUNCTION AND NOT A TABLE, because ordinal contexts are not bounded by the century range. A hardcoded
 * 2–20 map reachable only from the Roman rule lets `le 37e` and `le 190e` fall through, and the bare suffix is
 * then spoken as a stray word ([tʁɑ̃t sɛt ø], "thirty-seven uh").
 *
 * ⚠ HOMOGRAPHS ARE THE HARD PART OF THE ROMAN FORM, not decoding. The naive pattern "Roman letters + ordinal
 * suffix" matches `de`, `les`, `le`, `des`, `ce`, `vie`, `dire`, `lire`, `mer`, `ville`, `livre` — thousands of
 * instances of real words that decode as a numeral (DE = 500+…, LE = 50+…, DI = 501, LI = 51). The filter is
 * the Lexique
 * pronunciation lexicon itself: if the whole token is an attested French word, it is not a numeral. That
 * blocks every case above while leaving `XVIIe`, `XIe`, `Ve`, `LVIIIe` free, and it stays correct as the
 * lexicon grows. Three abbreviations/rare verbs are absent from Lexique and stoplisted explicitly.
 */
import { numberToWords } from "./numbers.ts";
import { romanToInt } from "../../core/roman.ts";

/** Magnitude words that carry a plural ⟨s⟩ in the cardinal but lose it before -ième. NOT a general
 *  "strip final s" rule — trois/six/dix keep theirs (troisième, sixième, dixième). */
const PLURAL_MAGNITUDES: ReadonlySet<string> = new Set([
    "vingts", "cents", "milliers", "millions", "milliards",
]);

/** Cardinal element → its -ième form (rules 1–4 above). */
function toIeme(word: string): string {
    const w = PLURAL_MAGNITUDES.has(word) ? word.slice(0, -1) : word;
    if (w === "un") return "unième"; // suppletive inside compounds: vingt-et-unième
    if (w === "cinq") return "cinquième";
    if (w === "neuf") return "neuvième";
    return (w.endsWith("e") ? w.slice(0, -1) : w) + "ième";
}

export interface OrdinalOptions {
    /** Feminine agreement. Only 1 (première) and 2 (seconde) distinguish gender; -ième forms are common. */
    feminine?: boolean;
    /** Plural agreement (premiers, deuxièmes). Silent in isolation but it governs liaison, so it is kept. */
    plural?: boolean;
}

/**
 * Integer ≥ 1 → the French ordinal, in this language's own orthography, for the engine to phonemize.
 * `undefined` for 0 and for non-integers — French has no ordinal for zero.
 *
 * The sub-100 group arrives from `numberToWords` already hyphenated as one orthographic word, which is
 * what lets the Lexique compounds resolve (dix-septième → [disɛtjɛm], with the single [s] that the
 * space-separated form got wrong); see numbers.ts.
 */
export function ordinal(n: number, { feminine = false, plural = false }: OrdinalOptions = {}): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    const s = plural ? "s" : "";
    if (n === 1) return (feminine ? "première" : "premier") + s;
    const words = numberToWords(n).split(" ");
    // Inflect the last element of the last group; the rest of the numeral stays cardinal.
    const parts = words.pop()!.split("-");
    parts[parts.length - 1] = toIeme(parts[parts.length - 1]!);
    const last = parts.join("-");
    // 10⁶ / 10⁹ exactly: "un million" → millionième. Keeping the "un" would make it a FRACTION
    // (un millionième = one millionth part), which is a different reading.
    if (words.length === 1 && words[0] === "un" && /^(million|milliard)ième$/.test(last)) words.pop();
    return [...words, last].join(" ") + s;
}

/** Feminine ordinal indicators: 1re / 1ère (and the common misspelling 1ere). */
const FEMININE_SUFFIX = /^(res?|ères?|eres?)$/;

/**
 * Suffix alternatives, LONGEST FIRST — JS alternation is leftmost-first, so `ers` must precede `er` or
 * `1ers` would read as `1er` followed by a stray s.
 */
const SUFFIXES = "ers|er|res|re|ères|ère|eres|ere|èmes|ème|emes|eme|es|e|des|de|ds|d";

/**
 * French letters. `\b` is NOT usable in these patterns: it is defined on ASCII word characters, so it
 * finds a boundary in the middle of an accented word — in `siècle` it split `siè` | `cle` and read CL as
 * 150. Adding the `u` flag does not change that, so the boundaries are explicit lookarounds instead.
 */
const L = "a-zà-ÿœæ";

/**
 * Digit ordinal notation → the spoken word. No space is permitted between the digits and the suffix:
 * French writes it attached, and allowing a gap would swallow "3 euros" / "5 ans".
 */
const DIGIT_NOTATION = new RegExp(`(?<![${L}\\d])(\\d+)(${SUFFIXES})(?![${L}\\d])`, "gi");

export function normalizeFrenchOrdinalDigits(text: string): string {
    if (!/\d/.test(text)) return text;
    return text.replace(DIGIT_NOTATION, (whole, digits: string, suffix: string) => {
        const n = Number(digits);
        const suf = suffix.toLowerCase();
        const plural = suf.endsWith("s");
        // second / seconde — licensed ONLY at 2. Unrestricted, this would read "3d" (3-D) as an ordinal.
        if (/^(d|ds|de|des)$/.test(suf)) {
            if (n !== 2) return whole;
            return (suf.startsWith("de") ? "seconde" : "second") + (plural ? "s" : "");
        }
        return ordinal(n, { feminine: FEMININE_SUFFIX.test(suf), plural }) ?? whole;
    });
}

/** Roman ordinals absent from Lexique, so the lexicon filter cannot catch them: the abbreviation Cie
 *  (compagnie) and two rare verb forms that decode as numerals (cive/CIV, clive/CLIV). */
const ROMAN_WORD_STOPLIST: ReadonlySet<string> = new Set(["cie", "cies", "cive", "cives", "clive", "clives"]);

/** Roman numeral + an ordinal suffix: XVIIe, XVIIème, IIe, Ve. Same explicit boundaries as above — this
 *  is the pattern that `siècle` tripped, since `cle` parses as CL + the -e suffix. */
const ROMAN_NOTATION = new RegExp(`(?<![${L}\\d])([ivxlcdm]+)(${SUFFIXES})(?![${L}\\d])`, "gi");

/**
 * Roman-numeral ordinals → the spoken ordinal word. `isWord` is the French lexicon membership test; the
 * whole token being an attested word is the homograph veto described in the file header.
 */
export function normalizeFrenchOrdinalRomans(text: string, isWord: (lower: string) => boolean): string {
    if (!/[ivxlcdm]/i.test(text)) return text;
    return text.replace(ROMAN_NOTATION, (whole, base: string, suffix: string) => {
        const lower = whole.toLowerCase();
        if (isWord(lower) || ROMAN_WORD_STOPLIST.has(lower)) return whole;
        const n = romanToInt(base);
        if (n === null) return whole;
        const suf = suffix.toLowerCase();
        return ordinal(n, { feminine: FEMININE_SUFFIX.test(suf), plural: suf.endsWith("s") }) ?? whole;
    });
}
