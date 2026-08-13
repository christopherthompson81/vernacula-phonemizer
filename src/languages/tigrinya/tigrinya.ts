/**
 * Native Tigrinya / ትግርኛ (ti) text phonemizer — canonical IPA. North Ethiosemitic (~9M,
 * Eritrea + Tigray), written in the Ge'ez/Fidäl SYLLABARY-abugida. Reads the SHARED Ge'ez engine (core/geez.ts) —
 * the same fidel→CV lookup + epenthetic-ɨ deletion as Amharic — over a Tigrinya fidel table. The split from
 * Amharic is the PRESERVED SEMITIC GUTTURALS: ⟨ሐ ኀ⟩→ħ, ⟨ዐ⟩→ʕ (the pharyngeals Amharic merged to h/ʔ), ⟨አ⟩→ʔ,
 * ⟨ኸ⟩→x, with the guttural 1st-order vowel kept central [ə]. Gemination is unwritten (folded); ejectives kʼ tʼ
 * t͡ʃʼ pʼ t͡sʼ.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeGeezG2P } from "../../core/geez.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makeTigrinyaNormalizer } from "./normalize.ts";

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
    // ⚠ OUT OF RANGE MUST STILL BE READ — see amharic.ts; returning `digits` leaks ASCII into the IPA.
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...digits].flatMap((c) => words(Number(c))).map(phonemizeWord).join(" ");
    return words(n).map(phonemizeWord).join(" ");
}

// Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
//
// ⚠ THE LETTER CLASS MUST NOT REACH THE PUNCTUATION SUB-BLOCK — the hazard for any script whose punctuation
// lives inside its own Unicode block, and the one that left Sylheti's terminator declared but unreachable.
// MEASURED for ti: the class ends at ፚ = U+135A while ። ፣ ፤ ፥ ፦ ፧ ፨ are U+1362–U+1368, above the range, so
// the letter branch cannot swallow them and all seven declarations fire. DO NOT widen this to the full block
// without moving the punctuation branch ahead of it.
//
// ⚠ AND THE NUMERALS ARE OUTSIDE EVERY BRANCH ON PURPOSE. U+1369–U+137C is above the class, is not `\d`, and
// is not punctuation, so `፻፲` reached no branch and read as the EMPTY STRING (20 instances in the artifact).
// They are rewritten to words in normalize.ts §12 rather than added here, because a numeral is a NUMBER and
// the reading it needs is the composer's, not the fidel table's.
const TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

// ሚእታዊት is the percent word, POSTPOSED. SOURCED THREE WAYS: this corpus ×2 (`ናይ ዝልከፋ ሚእታዊት ደቀኣንስትዮ ካብ 5%
// ክሳዕ 70%`), ti.wikipedia ×2, and Gaim (arXiv:2601.03403) Table 1 — the paper this manifest already cites for
// its cardinals — which names it as the percent word.
// ⚠ THE MAGNITUDE LIST IS LOAD-BEARING: the corpus writes `ብ1.65 ቢልዮን ዶላር` and `$17 ሚልዮን`, and without it
// the currency noun is inserted BEFORE the written magnitude. ⚠ ti SPELLS THEM WITH ል, NOT AMHARIC'S ሊ —
// ሚልዮን ×17, ቢልዮን ×6, ትሪልዮን ×4, against ×0 for ሚሊዮን/ቢሊዮን/ትሪሊዮን. Copying am's list would have matched
// nothing. No `magnitudeConnective`; ti takes none.
// ⚠ NO AMPERSAND AND NO MATH SIGNS: `&` ×27 is entirely wiki markup (`&nbsp;`, `&#x5B;`) and English strings,
// and `=` ×2 is an English gloss and a URL — the SIGN is absent from Tigrinya text, not the word. See
// normalize.ts's header for the counts.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ሚእታዊት"],
    // Each currency name is attested in a monetary amount, which is the sense check the sign alone cannot
    // make: ዶላር corpus ×6 (`1.65 ቢልዮን ዶላር`, `ልዕሊ 1 ትሪልዮን ዶላር`) + wiki ×12; ፓውንድ corpus ×3 (`800 ፓውንድ`)
    // + wiki ×3; ዩሮ wiki ×2, of which ONE is the slot (`222 ሚልዮን ዩሮ ዝውውር`) and one is the football
    // tournament `ዩሮ 2024` — recorded as resting on a single right-slot attestation.
    // ⚠ NO ናቕፋ. The Eritrean currency is ×5 in this corpus and every one is the TOWN of Nakfa
    // (`ናቕፋ ብድፋዓት ተኸቢባ ትርከብ`) — trap 37 — and no `Nfk` sign occurs to key it on anyway.
    currency: { "$": ["ዶላር"], "€": ["ዩሮ"], "£": ["ፓውንድ"] },
    // `20 km` read as `ʕɨsɾa ˈʊkm`, a raw Latin leak. The corpus writes the word out ×6 (ኪሎሜተር / ኪሎ ሜተር)
    // and ሜትሮ ×13, so both keys are the corpus's own spellings. ⚠ NO BARE ONE-LETTER KEY (traps 28/46):
    // ኪ.ሜ is handled locally in normalize.ts §8b because it also occurs with no adjacent number.
    units: { km: ["ኪሎ ሜተር"], m: ["ሜተር"], kg: ["ኪሎ ግራም"] },
    // ትርብዒት PRECEDES the unit — corpus ×7, wiki ×11, `916,445 ትርብዒት ኪ.ሜ`, `172,300 ትርብዒት ማይል`. No cube
    // word is declared: `m³`/`cubed` is ×0 in this corpus and ti.wikipedia offers nothing in the slot, which
    // is trap 51's floor rather than an oversight.
    exponentWords: { squared: ["ትርብዒት"], position: { squared: "before" } },
    magnitudes: ["ሚልዮን", "ቢልዮን", "ትሪልዮን"],
});

/** Text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9). */
const NORMALIZE = makeTigrinyaNormalizer(numberToText, SYMBOLS);

class TigrinyaPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(NORMALIZE(input), TOKEN, (m, sink) => {
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
