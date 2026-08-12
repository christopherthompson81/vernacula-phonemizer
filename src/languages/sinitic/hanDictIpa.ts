/**
 * Shared engine for the "IPA-already-in-the-dict" Sinitic bring-ups — Jin (cjy) and Hakka (hak). Unlike Wu and
 * Min Nan (which carry a romanization layer and convert romanization → IPA), these languages are sourced from
 * Wiktionary/kaikki Sinological-IPA, so the dict reading IS the segmental IPA + a superscript pitch-number tone
 * (馬 ma⁵³, 十 səp̚⁵). This module does the shared work: greedy longest-match Han segmentation over the dict, the
 * superscript-tone → Chao contour-letter conversion (taking the SURFACE tone after a sandhi arrow ⁻), and Han
 * numeral composition. A language module supplies only its dict + its Chao map + its punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";

export interface HanDictDef {
    /** Pitch digit ("1".."5") → Chao contour letter (˩..˥). */
    chao: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

/**
 * A language may widen the LATIN arm of the tokenizer. ⚠ ONE LANGUAGE NEEDS THIS AND THE REASON IS
 * STRUCTURAL: hak.wikipedia is written in Pha̍k-fa-sṳ, which joins the syllables of a word with HYPHENS
 * (`Hak-kâ-ngìn`). The default `LATIN_RUN` stops at the hyphen, so a PFS word arrived as three separate runs
 * and the reader could never see a WORD — which is exactly the unit that carries tone sandhi. Passing the
 * hyphen as a run character is what lets `pfs.ts` look up `hak-kâ` and get the sandhi baked reading, the
 * same way the Han path gets it from a multi-character dict key.
 * Left undefined by cjy, gan and hsn, which want the default.
 */
export type LatinRunOverride = string;

export type ForeignPhonemizer = (latin: string) => string;

const HAN = /\p{Script=Han}/u;
// Superscript pitch digits ⁰–⁹ used by the Sinological-IPA tone notation, and the sandhi arrow ⁻.
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const TONE_CHARS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻";

/**
 * One dict syllable (segmental IPA + a trailing superscript tone, possibly a sandhi arrow) → canonical IPA: the
 * segmental part unchanged + the tone as Chao contour letters. A sandhi arrow ⁵³⁻¹¹ means underlying 53 → SURFACE
 * 11 — we render the surface tone (what is actually pronounced).
 */
function syllableToIpa(syl: string, chao: Record<string, string>): string {
    // Split the trailing tone block (superscript digits + arrows) from the segmental body.
    let cut = syl.length;
    for (const ch of [...syl].reverse()) {
        if (TONE_CHARS.includes(ch)) cut -= ch.length;
        else break;
    }
    const body = syl.slice(0, cut);
    const toneBlock = syl.slice(cut);
    if (!toneBlock) return syl; // no tone (neutral/轻声 or a stray) → leave as-is
    const surface = toneBlock.split("⁻").pop()!; // surface tone = digits after the LAST sandhi arrow
    let contour = "";
    for (const ch of surface) {
        const d = SUP[ch];
        if (d !== undefined) contour += chao[d] ?? "";
    }
    return body + contour;
}

/** A space-separated dict reading → IPA. ⚠ EXPORTED so the Pha̍k-fa-sṳ reader renders tones through
 *  THIS function rather than a second copy — its table is emitted in dict.tsv's format for that reason. */
export function readingToIpa(reading: string, chao: Record<string, string>): string {
    return reading.trim().split(/\s+/u).map((s) => syllableToIpa(s, chao)).join(" ");
}

/** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
function hanRun(run: string, dict: Map<string, string>, maxWord: number, chao: Record<string, string>): string {
    const chars = [...run];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        let matched = "";
        let reading = "";
        for (let len = Math.min(maxWord, chars.length - i); len >= 1; len--) {
            const word = chars.slice(i, i + len).join("");
            const hit = dict.get(word);
            if (hit) {
                matched = word;
                reading = hit;
                break;
            }
        }
        if (reading) {
            out.push(readingToIpa(reading, chao));
            i += [...matched].length;
        } else i++; // no reading for this char → skip
    }
    return out.join(" ");
}

// Han numeral composition (shared Chinese system) — the Han string is then read through the dict, so number
// words pick up their sandhi and no separate number IPA is authored.
const DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SMALL = ["", "十", "百", "千"];
function under10000(n: number): string {
    if (n === 0) return "";
    let out = "";
    let zero = false;
    for (let p = 3; p >= 0; p--) {
        const unit = Math.floor(n / 10 ** p) % 10;
        if (unit === 0) {
            if (out) zero = true;
        } else {
            if (zero) out += DIGITS[0];
            zero = false;
            out += (p === 1 && unit === 1 && !out ? "" : DIGITS[unit]!) + SMALL[p]!;
        }
    }
    return out;
}
function integerToHan(n: number): string {
    if (n === 0) return DIGITS[0]!;
    if (n < 0) return "";
    const yi = Math.floor(n / 1_0000_0000);
    const wan = Math.floor((n % 1_0000_0000) / 10000);
    const rest = n % 10000;
    let out = "";
    if (yi) out += integerToHan(yi) + "億";
    if (wan) out += under10000(wan) + "萬";
    if (rest) {
        if ((yi || wan) && rest < 1000) out += DIGITS[0];
        out += under10000(rest);
    }
    return out;
}

/**
 * The digit-at-a-time reading — the fallback for a numeral `integerToHan` cannot compose. Deliberately the
 * LOCAL `DIGITS`, not `core/sinitic.ts`'s `spellHanDigits`: this string is read straight back through the
 * same dict as `integerToHan`'s output, so the two tables must be the same table. A shared one could drift
 * to 〇 (a real corpus choice for years) and the composed and fallback paths would then read one numeral two
 * ways for no reason the caller can see.
 */
function spellDigits(s: string): string {
    return [...s].map((c) => DIGITS[Number(c)] ?? c).join("");
}

// The greedy-segmentation window = the longest dict key (in code points). Cached per dict Map instance so it is
// scanned once, not on every phonemizeHanWord() call (the eval sweeps thousands of words through one dict).
const MAX_WORD_CACHE = new WeakMap<Map<string, string>, number>();
function maxWordFor(dict: Map<string, string>): number {
    let m = MAX_WORD_CACHE.get(dict);
    if (m === undefined) {
        m = 0;
        for (const k of dict.keys()) m = Math.max(m, [...k].length);
        MAX_WORD_CACHE.set(dict, m);
    }
    return m;
}

class HanDictPhonemizer implements Phonemizer {
    constructor(
        private dict: () => Map<string, string>,
        private def: HanDictDef,
        private foreign?: ForeignPhonemizer,
        private latinRun: LatinRunOverride = LATIN_RUN,
    ) {}
    text(input: string): string {
        const d = this.dict();
        const max = maxWordFor(d);
        // `assembleClauses` rather than a private exec loop: this engine's loop was already exactly that
        // shape (clauseSink + iterate the token regex), it just predated the shared helper — so it never
        // got the GAP PASS, and a run in a script it does not own was dropped outright. The Latin branch
        // below stays, because this engine claims Latin itself via `foreign`; the gap pass now covers
        // everything else (Greek, Cyrillic, Kana …) through the script router in core/scripts.ts.
        // ⚠ The Latin arm is ALL of Latin plus marks, not `[A-Za-z]+`: the ASCII class ended the token at a
        // diacritic and left that letter read as an English letter name (`Cañitas` → *kʰˈʌ ˈɛn ˈaᶦt̬əz*). The
        // engine routes a Latin run to the injected reader, so widening is the whole fix.
        const tok = new RegExp(`(\\p{Script=Han}+)|(\\d+)|(${this.latinRun})|([。，、？！；：.,?!;:])`, "gu");
        return assembleClauses(input, tok, (m, sink) => {
            if (m[1]) sink.emit(hanRun(m[1], d, max, this.def.chao));
            else if (m[2]) {
                // ⚠ AN UNSAFE INTEGER USED TO EMIT NOTHING AT ALL. The `isSafeInteger` test is right and
                // stays — above 2^53 the float has already lost its low digits, so `integerToHan` would
                // compose a numeral that is confidently WRONG (9007199254740993 arrives as …992) — but the
                // guard had no else, so the numeral was SILENTLY DELETED from the reading instead:
                // `9460730472580800 米` (a light-year in metres, and exactly what de-grouping a comma-grouped
                // figure produces) read as just *mi˨˩˧*. Seven engines shared this — gan hak cjy hsn wuu nan
                // yue — and cmn did not, because it composes numbers on another path; that asymmetry is why
                // no corpus diff or referee ever named it. A dropped digit is audible; a dropped NUMBER is
                // not, because the sentence still scans.
                // Digit-at-a-time is the fallback rather than BigInt: it is what Sinitic already does for a
                // year and a decimal tail, so it needs no new words and cannot be wrong about magnitude —
                // whereas composing 兆/京 above 億 would invent a register the dicts were never measured on.
                // The cost is stated plainly: above 2^53 the reading is a digit string, not a quantity.
                const n = Number(m[2]);
                sink.emit(hanRun(Number.isSafeInteger(n) ? integerToHan(n) : spellDigits(m[2]), d, max, this.def.chao));
            } else if (m[3]) sink.emit(this.foreign ? this.foreign(m[3]) : "");
            else if (m[4]) {
                const mk = this.def.clausePunctuation[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build a Han-dict phonemizer. `dict` is a lazy getter; `foreign` handles embedded Latin runs. */
export function createHanDictPhonemizer(
    dict: () => Map<string, string>,
    def: HanDictDef,
    foreign?: ForeignPhonemizer,
    latinRun?: LatinRunOverride,
): Phonemizer {
    return new HanDictPhonemizer(dict, def, foreign, latinRun);
}

/** Bare word→IPA (tests / eval): a Han run → IPA. */
export function phonemizeHanWord(dict: () => Map<string, string>, def: HanDictDef, word: string): string {
    if (!HAN.test(word)) return "";
    const d = dict();
    return hanRun(word, d, maxWordFor(d), def.chao);
}
