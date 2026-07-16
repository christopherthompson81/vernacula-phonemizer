/**
 * Min Nan / Taiwanese Hokkien (nan) phonemizer — canonical IPA. Sinitic, tonal (~50M speakers). Written in Han
 * characters and/or the Latin romanizations Tâi-lô / POJ. Two front-ends, one converter:
 *   • Han → Tâi-lô via dict.tsv (word→reading, greedy longest-match — the MOE 臺灣閩南語辭典) then Tâi-lô → IPA;
 *   • direct Tâi-lô / POJ input → IPA.
 * The Tâi-lô→IPA converter (minnan.jsonc, initial/final/tone maps from the epitran nan-Latn-tl spec): strip the
 * tone diacritic (identifies the tone) → [initial] + final → IPA + Chao tone letter. Sibilants PALATALISE before
 * i (ts/tsh/s/j+i → t͡ɕ/t͡ɕʰ/ɕ/d͡ʑ); checked finals -p̚/-t̚/-k̚, -h→ʔ; nasalised -nn vowels; syllabic m̩/ŋ̍.
 * Phase 1: segmental + CITATION tone (the tone-sandhi circle is deferred). See docs/nan_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

interface MinnanDef {
    initials: Record<string, string>;
    palatalBeforeI: Record<string, string>;
    finals: Record<string, string>;
    toneChao: Record<string, string>;
    toneSandhi?: Record<string, Record<string, string>>;
    clausePunctuation: Record<string, string>;
}
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
    const base = [...nfd].filter((c) => !(c in TONE_MARK)).join("").normalize("NFC").toLowerCase();
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

export type ForeignPhonemizer = (latin: string) => string;

class MinnanPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        const { sink, finish } = clauseSink();
        const tok =
            /(\p{Script=Han}+)|([A-Za-zàáâāǎ̀-̍]+(?:-[A-Za-zàáâāǎ̀-̍]+)*)|([。，、？！；：.,?!;:])/gu;
        let m: RegExpExecArray | null;
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(hanRun(m[1]));
            else if (m[2]) sink.emit(tailoToIpa(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        }
        void this.foreign;
        return finish();
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
