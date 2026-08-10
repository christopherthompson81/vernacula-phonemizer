/**
 * Cantonese / Yue (yue) phonemizer — canonical IPA. Written in Han characters; the front-end maps Han → Jyutping
 * via the rime-cantonese dictionary (dict.tsv, word→jyutping) with greedy longest-match segmentation (so
 * polyphones resolve by word: 銀行 ngan4hong4 vs 行路 haang4lou6). The back-end (cantonese.jsonc) maps each
 * Jyutping syllable → IPA: initial + final (the aː/ɐ long/short split, checked -p̚/-t̚/-k̚ codas) + one of the SIX
 * Cantonese tones as Chao contour letters. Direct Jyutping input (with tone digits) is also accepted.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
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
// ⚠ CASE-SENSITIVE. Jyutping is written lowercase; with the `i` flag an ALL-CAPS alphanumeric token like
// `MP3` matched, found no rime, and came back VERBATIM through the "leave the jyutping visible" fallback.
const JYUTPING = /^[a-z]+[1-6](?:\s+[a-z]+[1-6])*$/u;

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
 * ⚠ A COMPOSED NUMERAL MUST NOT GO THROUGH `hanRun()`. Greedy longest-match segmentation looks up whole WORDS,
 * and the rime-cantonese dict carries a colloquial lexical entry 十九 = "sap1 gau1" — so a composed number
 * containing 十九 is mis-toned: 29 → 二十九 segments as 二 + 十九 and comes out ji6 sap1 gau1 instead of
 * ji6 sap6 gau2, which hits every cardinal year ending in 9 with a non-zero tens digit (1469, 1759, 1989 …).
 * A number the ENGINE composed has no lexical word boundaries to discover — its characters are digits — so
 * per-character lookup is both the fix and the honest model. Text the AUTHOR wrote in Han numerals still goes
 * through `hanRun` and keeps whatever lexical reading the dict has for it.
 */
function numeralRun(han: string): string {
    return [...han]
        .map((c) => hanRun(c))
        .filter((s) => s !== "")
        .join(" ");
}

// Han numeral composition (shared Chinese system): 零一二三四五六七八九 + 十百千萬億. The Han string is then
// phonemized through the same dict→jyutping→IPA path, so no separate number IPA is authored. ⚠ DIGITS is owned
// by normalize.ts, so the digit-string reading (years, decimals) and this cardinal reading cannot drift apart.
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
 * LATIN LETTER NAMES IN JYUTPING — MINED FROM `dict.tsv`, NOT AUTHORED.
 *
 * An initialism embedded in Cantonese prose routed straight to the ENGLISH phonemizer: `中國GDP總量` read
 * …ɡˈiːdˈiːpʰˈiː…, English [iː], English stress, NO TONE, inside a tonal utterance. The header of
 * `normalize.ts` used to defer this for want of a letter table — while the shipped dict carried **541 Latin
 * keys** that this engine never consulted, including 69 whole acronyms with their readings (`DVD di1 wi1 di1`,
 * `ATM ei1 ti1 em1`, `GPS zi1 pi1 e1 si4`). The data was already here.
 *
 * ⚠ EVERY VALUE BELOW IS THE DICTIONARY'S OWN, recovered two ways and cross-checked:
 *   · the 13 SINGLE-LETTER keys — D di1, J zei1, K kei1, L eu1, M em1, N en1, P pi1, Q kiu1, R aau1,
 *     T ti1, X ik1 si4, Y waai1, Z ji6 set1;
 *   · per-letter alignment of the all-caps acronym entries, which supplies the other 11 with vote counts:
 *     B bi1 ×14, C si1 ×11, O ou1 ×11, A ei1 ×10, I aai1 ×9, V wi1 ×6, E ji1 ×4, G zi1 ×4, U ju1 ×2,
 *     and the two-syllable F e1 fu4 (`FF`) and S e1 si4 (`GPS`, `USB` — two independent entries).
 *
 * ⚠ TWO VOTES ARE REJECTED, and reading the source entry is what rejects them:
 *   · `CLS ci1 lan2 sin3` is 黐撚線, a PROFANITY spelled with letters — not letter names, so its C/L/S
 *     readings are not evidence. Left in, it would have shipped `S = sin3`.
 *   · `WP win1 pei1` and `LM lau4 ming4` are NAMES, not initialisms.
 * The former is why S is taken from GPS/USB instead, and it is playbook trap 2 in miniature: the count was
 * there, the sense was not.
 *
 * ⚠ H AND W ARE ABSENT FROM EVERY SOURCE — no single-letter key, no acronym, and espeak ships no Cantonese
 * letter table at all (its `yue_list` has zero Latin entries). Rather than invent them, a run containing an
 * unsourced letter is left WHOLE on the English reader: a half-Cantonese, half-English token would be worse
 * than either. Measured cost in the mined artifact: 3 of 13 all-caps tokens (`HK`, `NSW`, `NPWS`).
 */
const LETTERS: Readonly<Record<string, string>> = {
    A: "ei1", B: "bi1", C: "si1", D: "di1", E: "ji1", F: "e1 fu4", G: "zi1", I: "aai1", J: "zei1",
    K: "kei1", L: "eu1", M: "em1", N: "en1", O: "ou1", P: "pi1", Q: "kiu1", R: "aau1", S: "e1 si4",
    T: "ti1", U: "ju1", V: "wi1", X: "ik1 si4", Y: "waai1", Z: "ji6 set1",
};

/**
 * A Latin run → IPA, preferring what the language records over what English would say.
 *
 * ⚠ ONLY ALL-CAPS RUNS ARE CLAIMED. The dict's other Latin keys are lowercase ENGLISH LOANS (`bar baa1`,
 * `account aa6 kaan1`) whose Cantonese reading is right for a loan and wrong for the quoted English the
 * corpus also contains, and nothing in the surface form separates the two. Initialisms have no such
 * ambiguity, so they are the whole of the claim.
 *
 * ⚠ `[IVX]{2,3}` is excluded because Roman numerals belong to `core/roman.ts`, which runs in the registry
 * WRAPPING `text()` — what reaches here is what it declined. Length 2–4, and not flanked by a Latin letter
 * or digit, for the reasons `wu/normalize.ts` step 14 records at length.
 */
function latinRun(run: string, foreign?: ForeignPhonemizer): string {
    const english = (): string => (foreign ? foreign(run) : "");
    if (!/^[A-Z]{2,}$/u.test(run) || /^[IVX]{2,3}$/u.test(run)) return english();
    // A RECORDED acronym outranks spelling it out: the reading is a lexical fact and the dict has it
    // (`DVD`, `ATM`, `USB`, `ID`, `IT`, `BBQ`…), tones and all. This is `core/initialisms.ts`'s own
    // architecture — a known acronym resolves through the lexicon; only an OOV one is spelled.
    const recorded = dict().get(run);
    if (recorded !== undefined) return jyutpingToIpa(recorded);
    // ⚠ SPELLING is capped at 3 letters while the DICT LOOKUP above is not, and the asymmetry is the point:
    // a recorded reading is a LEXICAL fact and needs no guard, whereas spelling an unrecorded 4-letter run
    // is where English WORDS start being mistaken for acronyms — measured on the cmn corpus, 9 of 16
    // four-letter tokens are words (FIFA ×7, BANK, SEAL). yue's own corpus is too small to show it (13
    // all-caps tokens), so this follows the sibling's measurement rather than pretending to its own.
    if (run.length > 3) return english();
    if (![...run].every((c) => LETTERS[c] !== undefined)) return english(); // H/W — see above
    return [...run].map((c) => jyutpingToIpa(LETTERS[c]!)).join(" ");
}

export type ForeignPhonemizer = (latin: string) => string;

class CantonesePhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Whole-string Jyutping input (tone digits present) → direct path.
        if (JYUTPING.test(input.trim())) return jyutpingToIpa(input);
        // The normalization pass runs FIRST, so what reaches the tokenizer is either a word the dict speaks or
        // a number whose CARDINAL reading is the correct one.
        input = normalizeCantonese(input, DEF.measureWords);
        // ⚠ `assembleClauses`, NOT a private exec loop. A hand-rolled clauseSink + token loop is the same shape
        // but gets no GAP PASS, so a run in a script the engine does not own is dropped. This engine claims
        // Latin itself; the gap pass covers everything else via the script router (core/scripts.ts).
        // The clause-mark alternation is built from the manifest's keys, so adding a mark to the data is enough.
        // ⚠ The Latin run is `\p{Script=Latin}` + combining marks, NOT `[A-Za-z]`: the ASCII class splits every
        // accented name into fragments — Müslüm Gürses reaches the English phonemizer as M / sl / m / G / rses
        // ("ˈɛm sɫ ˈɛm …") instead of two words.
        const marks = Object.keys(CLAUSE_MARK)
            .map((k) => k.replace(/[.*+?^${}()|[\]\\-]/gu, "\\$&"))
            .join("");
        const tok = new RegExp(
            `(\\p{Script=Han}+)|(\\d+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${marks}])`,
            "gu",
        );
        
        return assembleClauses(input, tok, (m, sink) => {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n)) sink.emit(numeralRun(integerToHan(n)));
            } else if (m[3]) sink.emit(latinRun(m[3], this.foreign));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
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
