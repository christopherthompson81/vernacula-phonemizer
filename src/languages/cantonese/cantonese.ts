/**
 * Cantonese / Yue (yue) phonemizer — canonical IPA. Written in Han characters; the front-end maps Han → Jyutping
 * via the rime-cantonese dictionary (dict.tsv, word→jyutping) with greedy longest-match segmentation (so
 * polyphones resolve by word: 銀行 ngan4hong4 vs 行路 haang4lou6). The back-end (cantonese.jsonc) maps each
 * Jyutping syllable → IPA: initial + final (the aː/ɐ long/short split, checked -p̚/-t̚/-k̚ codas) + one of the SIX
 * Cantonese tones as Chao contour letters. Direct Jyutping input (with tone digits) is also accepted.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { DIGITS, normalizeCantonese } from "./normalize.ts";

interface CantoneseDef {
    initials: Record<string, string>;
    finals: Record<string, string>;
    tones: Record<string, string>;
    clausePunctuation: Record<string, string>;
    measureWords: string;
}
const DEF = loadManifest<CantoneseDef>(import.meta.url, "cantonese.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Initials tried longest-first so ng/gw/kw win over n/g/k.
const INITIALS = Object.keys(DEF.initials).sort((a, b) => b.length - a.length);

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    return (DICT ??= loadTsvMap(import.meta.url, "dict.tsv"));
}
const MAX_WORD = 6; // greedy segmentation window

const HAN = /\p{Script=Han}/u;
const JYUTPING = /^[a-z]+[1-6](?:\s+[a-z]+[1-6])*$/i;

/** One Jyutping syllable (e.g. "hoeng1") → IPA. */
function syllableToIpa(syl: string): string {
    const m = /^([a-z]+?)([1-6])$/i.exec(syl);
    if (!m) return syl;
    const body = m[1]!.toLowerCase();
    const tone = DEF.tones[m[2]!] ?? "";
    // Syllabic nasal (m / ng stand alone, no initial).
    if (body === "m" || body === "ng")
        return (DEF.finals[body] ?? body) + tone;
    // Parse initial (longest match) + final.
    let initial = "",
        rest = body;
    for (const ini of INITIALS)
        if (body.startsWith(ini) && DEF.finals[body.slice(ini.length)]) {
            initial = DEF.initials[ini]!;
            rest = body.slice(ini.length);
            break;
        }
    const final = DEF.finals[rest];
    if (final === undefined) return syl; // unknown rime → leave the jyutping visible
    return initial + final + tone;
}

/** A space-separated Jyutping string → IPA. */
function jyutpingToIpa(jp: string): string {
    return jp
        .trim()
        .split(/\s+/u)
        .map(syllableToIpa)
        .join(" ");
}

/** A Han run → IPA (greedy longest-match over the dictionary; unknown chars are skipped). */
function hanRun(run: string): string {
    const chars = [...run];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        let matched = "";
        let jp = "";
        for (let len = Math.min(MAX_WORD, chars.length - i); len >= 1; len--) {
            const word = chars.slice(i, i + len).join("");
            const hit = dict().get(word);
            if (hit) {
                matched = word;
                jp = hit;
                break;
            }
        }
        if (jp) {
            out.push(jyutpingToIpa(jp));
            i += [...matched].length;
        } else i++; // no reading for this char → skip
    }
    return out.join(" ");
}

/**
 * A SYNTHESIZED numeral string → IPA, read one character at a time.
 *
 * #562: it must NOT go through hanRun(). Greedy longest-match segmentation looks up whole words, and the
 * rime-cantonese dict carries a colloquial lexical entry 十九 = "sap1 gau1" — so every composed number
 * containing 十九 was mis-toned: 29 → 二十九 segmented as 二 + 十九 and came out ji6 sap1 gau1 instead of
 * ji6 sap6 gau2. 18 of the 208 distinct integers in the corpus were hit, all from that one entry, including
 * every cardinal year ending in 9 with a non-zero tens digit (1469, 1759, 1889, 1989 …). A number the engine
 * itself composed has no lexical word boundaries to discover — its characters are digits — so per-character
 * lookup is both the fix and the honest model. Text the AUTHOR wrote in Han numerals still goes through
 * hanRun and keeps whatever lexical reading the dict has for it.
 */
function numeralRun(han: string): string {
    return [...han]
        .map((c) => hanRun(c))
        .filter((s) => s !== "")
        .join(" ");
}

// Han numeral composition (shared Chinese system): 零一二三四五六七八九 + 十百千萬億. The Han string is then
// phonemized through the same dict→jyutping→IPA path, so no separate number IPA is authored. DIGITS is owned
// by normalize.ts so the digit-string reading (years, decimals) and this cardinal reading cannot drift apart.
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

export type ForeignPhonemizer = (latin: string) => string;

class CantonesePhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Whole-string Jyutping input (tone digits present) → direct path.
        if (JYUTPING.test(input.trim())) return jyutpingToIpa(input);
        // #562: the Cantonese normalization pass runs first, so what reaches the tokenizer is either a word
        // the dict speaks or a number whose CARDINAL reading is the correct one.
        input = normalizeCantonese(input, DEF.measureWords);
        const { sink, finish } = clauseSink();
        // The clause-mark alternation is the manifest's keys, so adding a mark to the data is enough (…, ─,
        // the ﹑ variant comma). The Latin run is \p{Script=Latin} + combining marks, not [A-Za-z]: the ASCII
        // class split every accented name into fragments — Müslüm Gürses reached the English phonemizer as
        // M / sl / m / G / rses ("ˈɛm sɫ ˈɛm …") instead of two words. 9 tokens in the corpus.
        const marks = Object.keys(CLAUSE_MARK)
            .map((k) => k.replace(/[.*+?^${}()|[\]\\-]/gu, "\\$&"))
            .join("");
        const tok = new RegExp(
            `(\\p{Script=Han}+)|(\\d+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${marks}])`,
            "gu",
        );
        let m: RegExpExecArray | null;
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n)) sink.emit(numeralRun(integerToHan(n)));
            } else if (m[3]) sink.emit(this.foreign ? this.foreign(m[3]) : "");
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        }
        return finish();
    }
}

/** Build the Cantonese phonemizer. `foreign` handles embedded Latin runs. */
export function createCantonese(foreign?: ForeignPhonemizer): Phonemizer {
    return new CantonesePhonemizer(foreign);
}

/** Bare word→IPA (tests / eval): Han → IPA, or direct Jyutping. */
export function phonemizeWord(word: string): string {
    return HAN.test(word) ? hanRun(word) : jyutpingToIpa(word);
}
