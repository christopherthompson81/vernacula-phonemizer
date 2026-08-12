/**
 * Min Nan / Taiwanese Hokkien (nan) phonemizer — canonical IPA. Sinitic, tonal (~50M speakers). Written in Han
 * characters and/or the Latin romanizations Tâi-lô / POJ. Two front-ends, one converter:
 *   • Han → Tâi-lô via dict.tsv (word→reading, greedy longest-match — the MOE 臺灣閩南語辭典) then Tâi-lô → IPA;
 *   • direct Tâi-lô / POJ input → IPA — POJ via `pojToTailo`, which folds the six correspondences the
 *     two orthographies differ on before the Tâi-lô tables see the syllable.
 * The Tâi-lô→IPA converter (minnan.jsonc, initial/final/tone maps from the epitran nan-Latn-tl spec): strip the
 * tone diacritic (identifies the tone) → [initial] + final → IPA + Chao tone letter. Sibilants PALATALISE before
 * i (ts/tsh/s/j+i → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ); checked finals -p̚/-t̚/-k̚, -h→ʔ; nasalised -nn vowels; syllabic m̩/ŋ̍.
 *
 * Segmental + CITATION tone. The tone-sandhi circle is DEFERRED — it is phrase-level and not recoverable
 * from a syllable-at-a-time conversion.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses, clauseSink } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { spellHanDigits } from "../../core/sinitic.ts";

interface MinnanDef {
    initials: Record<string, string>;
    palatalBeforeI: Record<string, string>;
    finals: Record<string, string>;
    toneChao: Record<string, string>;
    toneSandhi?: Record<string, Record<string, string>>;
    clausePunctuation: Record<string, string>;
}
import { normalizeMinNan } from "./normalize.ts";

const DEF = loadManifest<MinnanDef>(import.meta.url, "minnan.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Onset consonants tried longest-first; the palatalised keys (tsi/tshi/si/ji) are handled by the rule, not here.
const PALATAL = DEF.palatalBeforeI;
const INITIALS = Object.keys(DEF.initials)
    .filter((k) => !["tsi", "tshi", "si", "ji"].includes(k)) // palatalised forms handled by the rule
    .sort((a, b) => b.length - a.length);

// Tâi-lô tone diacritics (combining) → tone number. Unmarked = 1 (open) / 4 (checked).
const TONE_MARK: Record<string, string> = {
    "́": "2", "̀": "3", "̂": "5", "̌": "6",
    "̄": "7", "̍": "8", "̋": "9",
};

let DICT: Map<string, string> | undefined;
function dict(): Map<string, string> {
    if (DICT) return DICT;
    // Single-char Han→Tâi-lô SUPPLEMENT (ChhoeTaigi dictionaries; closes the coverage gap) loaded FIRST, then the
    // main MOE word dict overlaid so it wins on any overlap (see dict-chars.tsv).
    DICT = loadTsvMap(import.meta.url, "dict-chars.tsv", (v) => v, { optional: true });
    for (const [k, v] of loadTsvMap(import.meta.url, "dict.tsv")) DICT.set(k, v);
    return DICT;
}
const MAX_WORD = 6;
const HAN = /\p{Script=Han}/u;

/**
 * POJ (Pe̍h-ōe-jī) → Tâi-lô, on a TONELESS base syllable.
 *
 * ⚠ WHY THIS EXISTS: THE CONVERTER WAS TÂI-LÔ-ONLY WHILE THE HEADER CLAIMED BOTH. `minnan.jsonc`'s finals
 * table is the epitran nan-Latn-tl spec — it declares `oo`, `ann`, `ing`, `ik`, `ua`, `ue`, which are the
 * TÂI-LÔ spellings — so POJ input worked exactly where the two orthographies coincide (`hong`, `tang`) and
 * fell through to the "unknown rime → leave visible" fallback everywhere else. Measured on the nan corpus,
 * which IS POJ (nan.wikipedia's convention): **533 of 3,805 distinct word types, 1,482 tokens**, emitted raw
 * romanization instead of IPA — `pêng-hong` → *peng˧ hɔŋ˥*, `gō͘` → *go͘˧*, `chi` → *chi˥*.
 *
 * ⚠ AND NO LEAK CLASS COULD SEE IT. `DIGIT`, `SLOT-GAP`, `RAWMARK` and `ZERO-WIDTH` hunt digits, spacing and
 * punctuation; an unmapped syllable is Latin letters with a tone letter attached and looks exactly like
 * ordinary IPA — which is largely ASCII by design (38% of this repo's output characters). What exposed it
 * was probing for ASCII ⟨g⟩, since canonical IPA uses ɡ U+0261 and this repo emits that everywhere else:
 * wuu/cmn/yue/jv scored 0 and nan scored 1,482.
 *
 * ⚠ APPLIED TO THE TONELESS BASE, WHICH IS WHAT MAKES IT A PLAIN SUBSTITUTION. `syllableParts` has already
 * pulled the tone diacritics off, so nothing here has to move a combining mark from one vowel to another —
 * the classic way an orthography fold corrupts its input.
 *
 * ⚠ SAFE ON TÂI-LÔ INPUT BY CONSTRUCTION: every left-hand side is a spelling Tâi-lô does not use (it writes
 * `ts`/`tsh`, `oo`, `nn`, `ua`, `ue`, `ing`, `ik`), so the fold is a no-op on the Han path's dict readings.
 * Verified against those readings — and it turns out to IMPROVE them: 40 of the 70,535 MOE entries carry
 * stray POJ spellings (`chı̍t-bóe-hî`, `pêⁿ-chha-sò͘-chōa`, `Lîng-tek`) that were leaking too.
 */
function pojToTailo(base: string): string {
    return (
        base
            // ⚠ BOTH DOT SPELLINGS. POJ's ⟨o͘⟩ is U+0358 COMBINING DOT ABOVE RIGHT, but running text also
            // writes it as a MIDDLE DOT — this corpus has 234 of the former and 141 of the latter.
            .replace(/o[\u0358\u00b7\u2027]/gu, "oo")
            .replace(/chh/gu, "tsh") // longest-first, or `ch` eats the digraph
            .replace(/ch/gu, "ts")
            .replace(/oa/gu, "ua")
            .replace(/oe/gu, "ue")
            .replace(/eng/gu, "ing")
            .replace(/ek/gu, "ik")
            // The nasalisation mark, U+207F, written syllable-finally in POJ exactly as Tâi-lô writes ⟨nn⟩.
            .replace(/\u207f/gu, "nn")
    );
}

/** A toneless Tâi-lô base syllable → segmental IPA (initial + final, with sibilant palatalisation). */
function baseToIpa(base: string): string {
    if (base === "m") return "m̩";
    if (base === "ng") return "ŋ̍";
    if (base === "mh") return "m̩ʔ"; // syllabic-nasal + checked -h (standalone; the initial-scan would eat the m)
    if (base === "ngh") return "ŋ̍ʔ";
    let ini = "";
    for (const k of INITIALS)
        if (base.startsWith(k)) {
            ini = k;
            break;
        }
    const rest = base.slice(ini.length);
    const iniIpa =
        ini in PALATAL && rest.startsWith("i") ? PALATAL[ini]! : (DEF.initials[ini] ?? "");
    const fin = DEF.finals[rest];
    if (fin === undefined) return base; // unknown rime → leave visible
    // Checked-syllable stop coda → unreleased p̚/t̚/k̚ (as for Cantonese; epitran omits the mark).
    return iniIpa + fin.replace(/([ptk])$/u, "$1̚");
}

/** One Tâi-lô/POJ syllable → (segmental IPA, tone CATEGORY). Unmarked tone: checked (coda -p/-t/-k/-h) = 4, open = 1. */
function syllableParts(syl: string): { seg: string; tone: string } | null {
    const nfd = syl.normalize("NFD");
    let tone = "";
    for (const ch of nfd) if (TONE_MARK[ch]) tone = TONE_MARK[ch]!;
    const base = pojToTailo(
        [...nfd].filter((c) => !(c in TONE_MARK)).join("").normalize("NFC").toLowerCase(),
    );
    if (!base) return null;
    if (!tone) tone = /[ptkh]$/u.test(base) ? "4" : "1";
    return { seg: baseToIpa(base), tone };
}

const SANDHI = DEF.toneSandhi;
/** Coda class of a segmental syllable, selecting the tone-sandhi sub-table: -p/-t/-k → stop (4↔8), -h → glottal
 *  (ʔ; 4→2, 8→3), else open (the main circle). */
function codaClass(seg: string): "stop" | "glottal" | "open" {
    if (/[ptk]̚$/u.test(seg)) return "stop"; // unreleased p̚/t̚/k̚
    if (seg.endsWith("ʔ")) return "glottal"; // -h
    return "open";
}

/** A Tâi-lô/POJ word (hyphen/space-joined syllables) → IPA. Tone SANDHI (連讀變調) applies WORD-INTERNALLY: every
 *  syllable but the LAST takes its sandhi tone (the Taiwanese tone circle); the final syllable keeps citation tone.
 *  Sandhi changes ONLY the tone — segments (incl. the checked coda) are unchanged. Cross-word (phrase-level tone
 *  group) sandhi is deferred: each dict word / hyphenated Tâi-lô token is treated as one tone group. */
function tailoToIpa(word: string): string {
    const sylls = word
        .split(/[-\s]+/u)
        .filter(Boolean)
        .map(syllableParts)
        .filter((s): s is { seg: string; tone: string } => s !== null);
    const last = sylls.length - 1;
    return sylls
        .map(({ seg, tone }, i) => {
            const t = SANDHI && i < last ? (SANDHI[codaClass(seg)]?.[tone] ?? tone) : tone;
            return seg + (DEF.toneChao[t] ?? "");
        })
        .join(" ");
}

/** A Han run → IPA (greedy longest-match over dict → Tâi-lô → IPA; unknown chars skipped). */
function hanRun(run: string): string {
    const chars = [...run];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        let matched = "",
            reading = "";
        for (let len = Math.min(MAX_WORD, chars.length - i); len >= 1; len--) {
            const w = chars.slice(i, i + len).join("");
            const hit = dict().get(w);
            if (hit) {
                matched = w;
                reading = hit;
                break;
            }
        }
        if (reading) {
            out.push(tailoToIpa(reading));
            i += [...matched].length;
        } else i++;
    }
    return out.join(" ");
}

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────
// Digit runs were dropped entirely (the tokenizer had no (\d+) branch). Min Nan is Sinitic, so — exactly as in
// cantonese.ts — an integer is composed into the shared Chinese numeral string 零一二三四五六七八九 + 十百千萬億
// (myriad grouping: 萬 10⁴, 億 10⁸) and READ THROUGH THE SHIPPED HAN DICTIONARY. No numeral readings are authored
// here: every character's Tâi-lô comes from dict() (dict-chars.tsv, the ChhoeTaigi single-char supplement, overlaid
// by the MOE word dict — see dict.PROVENANCE.md), and the Tâi-lô→IPA converter does the rest.
//
// Two deliberate departures from cantonese.ts's plain hanRun():
//  1. the numeral string is read CHARACTER BY CHARACTER rather than by greedy longest word match, because the word
//     dict carries numeral-shaped multi-char entries whose readings are not the numeral reading (e.g. 一百 is
//     entered as tsi̍t-pà, whereas the numeral is tsi̍t-pah — cf. 一百箍 tsi̍t-pah-khoo in the same dict);
//  2. ONE positional rule: 一 is /it/ as a final unit digit but /tsi̍t/ as a magnitude multiplier — 十一 tsa̍p-it,
//     二十一 jī-tsa̍p-it (attested in dict.tsv as 十一叔 tsa̍p-it-tsik) vs 一百 tsi̍t-pah. The dict's single-char entry
//     is the multiplier form tsi̍t, so only the final-unit case needs the override.
// The characters are hyphen-joined into one Tâi-lô token so the existing word-internal tone sandhi applies across
// the numeral, as it does in speech.
const HAN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const HAN_SMALL = ["", "十", "百", "千"];
const HAN_MAG = new Set(["十", "百", "千", "萬", "億"]);

function under10000(n: number): string {
    if (n === 0) return "";
    let out = "";
    let zero = false;
    for (let p = 3; p >= 0; p--) {
        const unit = Math.floor(n / 10 ** p) % 10;
        if (unit === 0) {
            if (out) zero = true;
        } else {
            if (zero) out += HAN_DIGITS[0];
            zero = false;
            out += (p === 1 && unit === 1 && !out ? "" : HAN_DIGITS[unit]!) + HAN_SMALL[p]!; // leading 一十 → 十
        }
    }
    return out;
}

/** An integer → the Chinese numeral string (myriad grouping 萬/億), as in cantonese.ts. */
function integerToHan(n: number): string {
    if (n === 0) return HAN_DIGITS[0]!;
    if (n < 0) return "";
    const yi = Math.floor(n / 1_0000_0000);
    const wan = Math.floor((n % 1_0000_0000) / 10000);
    const rest = n % 10000;
    let out = "";
    if (yi) out += integerToHan(yi) + "億";
    if (wan) out += under10000(wan) + "萬";
    if (rest) {
        if ((yi || wan) && rest < 1000) out += HAN_DIGITS[0];
        out += under10000(rest);
    }
    return out;
}

/** A Chinese numeral string → IPA: per-character dict readings (+ the 一 it/tsi̍t rule), hyphen-joined so tone
 *  sandhi runs across the numeral. */
function hanNumeralRun(han: string): string {
    const chars = [...han];
    const tailo = chars
        .map((c, i) => {
            if (c === "一" && !HAN_MAG.has(chars[i + 1] ?? "")) return "it"; // final unit digit, not a multiplier
            return dict().get(c) ?? "";
        })
        .filter(Boolean)
        .join("-");
    return tailoToIpa(tailo);
}

/**
 * Han run · digits · a POJ word (Latin plus its combining marks AND the hyphen, since POJ joins syllables
 * with one) · clause punctuation.
 *
 * ⚠ HOISTED OUT OF `text()`, and not only to stop rebuilding a constant regex per call: the string "Latin"
 * is a SCRIPT NAME for `hostWordRun`, and inside `text()` it tripped `review.ts`'s trap-6 check — the one
 * that catches a word SPELLING reaching the phoneme sink. A false positive, but the gate cannot tell a
 * script identifier from a word, and a permanently red line teaches nothing.
 */
const TOKEN = new RegExp(
    `(\\p{Script=Han}+)|(\\d+)|(${hostWordRun(["Latin"], "", "-")})|([。，、？！；：.,?!;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

class MinnanPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Everything that is not yet a pronounceable word → words the pipeline already speaks. See
        // normalize.ts, whose ordering is governed by POJ writing its polysyllables WITH HYPHENS.
        input = normalizeMinNan(input);
        // `assembleClauses` rather than a private exec loop: this loop was already exactly that shape
        // (clauseSink + iterate the token regex), it just predated the shared helper — so it never got the
        // GAP PASS and a run in a script it does not own was dropped. The engine still claims Latin
        // itself; the gap pass covers everything else via the script router (core/scripts.ts).
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) {
                // ⚠ ABOVE 2^53 THIS USED TO EMIT NOTHING — see hanDictIpa.ts for the full account. The guard
                // is right and stays; what was missing is the else, so the numeral was deleted rather than
                // degraded. Digit-at-a-time is what nan already gives a year.
                const n = Number(m[2]);
                sink.emit(hanNumeralRun(Number.isSafeInteger(n) ? integerToHan(n) : spellHanDigits(m[2], HAN_DIGITS)));
            } else if (m[3]) sink.emit(tailoToIpa(nat(m[3])));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Min Nan phonemizer. `foreign` handles embedded (non-Tâi-lô) Latin runs. */
export function createMinnan(foreign?: ForeignPhonemizer): Phonemizer {
    return new MinnanPhonemizer(foreign);
}

/** Bare word→IPA (tests / eval): Han → IPA, or direct Tâi-lô. */
export function phonemizeWord(word: string): string {
    return HAN.test(word) ? hanRun(word) : tailoToIpa(word);
}

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 *
 * ⚠ THE CAPITALS `ÀÁÂĀǍ` MUST BE LISTED ALONGSIDE THE LOWER CASE. Listing only the lower-case Tâi-lô tone
 * vowels means `TÂI` fails the inventory test where `tâi` passes, so a CAPITALISED native word is treated as
 * foreign and the fold strips its tone diacritic — a silent DELETION, since this class drives the fold and
 * not merely the tokenization. Any class that omits the upper case of its own letters has the same bug.
 */
const NATIVE_CLASS = "[A-Za-zàáâāǎÀÁÂĀǍ̀-̍]";
const nat = makeNativiser(NATIVE_CLASS, "u");