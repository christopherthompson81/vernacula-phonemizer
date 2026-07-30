/**
 * Native Tigrinya / ትግርኛ (ti) text phonemizer — canonical IPA, espeak-independent. North Ethiosemitic (~9M,
 * Eritrea + Tigray), written in the Ge'ez/Fidäl SYLLABARY-abugida. Reads the SHARED Ge'ez engine (core/geez.ts) —
 * the same fidel→CV lookup + epenthetic-ɨ deletion as Amharic — over a Tigrinya fidel table. The split from
 * Amharic is the PRESERVED SEMITIC GUTTURALS: ⟨ሐ ኀ⟩→ħ, ⟨ዐ⟩→ʕ (the pharyngeals Amharic merged to h/ʔ), ⟨አ⟩→ʔ,
 * ⟨ኸ⟩→x, with the guttural 1st-order vowel kept central [ə]. Gemination is unwritten (folded); ejectives kʼ tʼ
 * t͡ʃʼ pʼ t͡sʼ. See docs/investigations/ti_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeGeezG2P } from "../../core/geez.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teenPrefix: string;
    tens: Record<string, string>;
    hundred: string;
    hundredConjoined: string;
    thousand: string;
    million: string;
    billion: string;
    conjunction: string;
}
interface TigrinyaDef {
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<TigrinyaDef>(import.meta.url, "tigrinya.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

/** One Tigrinya word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
export const phonemizeWord = makeGeezG2P(import.meta.url, "fidel.tsv");

// ── Numbers (decimal; Tigrinya — Gaim, arXiv:2601.03403 Table 1 + §3.1-3.3) ───
// A number is an ADDITIVE CHAIN of terms (900 + 90 + 9); each term is either a bare word, a teen (two words, no
// internal conjunction), or multiplier + scale word. §3.1-3.3: when the chain has ≥ 2 terms EVERY term takes the
// ን "and" suffix on its LAST word; a 1-term chain takes none (40 → ኣርብዓ, 700 → ሸውዓተ ሚእቲ, 25000 → ዕስራን ሓሙሽተን ሽሕ).
// ሚእቲ alternates to ሚእትን when suffixed (§3.2); every other word simply appends ን.
/** One additive term = the ordered words it is spoken as. */
type Term = string[];

/** Suffix the ን conjunction onto a term's last word (ሚእቲ takes its ሚእትን allomorph). */
function conjoin(term: Term): Term {
    const last = term[term.length - 1]!;
    return [...term.slice(0, -1), last === NUM.hundred ? NUM.hundredConjoined : last + NUM.conjunction];
}

/** Decompose n (> 0) into its additive terms, most significant first. */
function terms(n: number): Term[] {
    const SCALES: [number, string][] = [
        [1_000_000_000, NUM.billion], [1_000_000, NUM.million], [1000, NUM.thousand], [100, NUM.hundred],
    ];
    for (const [value, scale] of SCALES) {
        if (n >= value) {
            const q = Math.floor(n / value), r = n % value;
            // The multiplier is NOT a chain term of its own (309 → ሰለስተ ሚእትን …, ሰለስተ bare), so it is spoken
            // with its own internal conjunctions and then the scale word is appended: 34 000 → ሰላሳን ኣርባዕተን ሽሕ.
            const head: Term = [...(q === 1 ? [] : words(q)), scale];
            return [head, ...(r ? terms(r) : [])];
        }
    }
    if (n < 10) return [[NUM.units[n]!]];
    if (n === 10) return [[NUM.ten]];
    if (n < 20) return [[NUM.teenPrefix, NUM.units[n - 10]!]]; // ONE term, no internal ን
    // tens are keyed by the ROUND value ("20".."90") — Math.floor(n/10) alone looked up "2".."9" and every
    // Tigrinya tens word silently vanished (21-99 lost its first slot, 20-90 rendered empty).
    const t = Math.floor(n / 10) * 10, u = n % 10;
    return [[NUM.tens[String(t)]!], ...(u ? [[NUM.units[u]!]] : [])];
}

/** n ≥ 0 → the Tigrinya number words, conjunctions applied. */
function words(n: number): string[] {
    if (n === 0) return [NUM.units[0]!];
    const chain = terms(n);
    return (chain.length > 1 ? chain.map(conjoin) : chain).flat();
}

function numberToText(n: number): string {
    if (n < 0) return "";
    return words(n).join(" ");
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return digits;
    return words(n).map(phonemizeWord).join(" ");
}

// Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
const TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class TigrinyaPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Tigrinya phonemizer. `foreign` handles embedded Latin runs. */
export function createTigrinya(foreign?: ForeignPhonemizer): Phonemizer {
    return new TigrinyaPhonemizer(foreign);
}
