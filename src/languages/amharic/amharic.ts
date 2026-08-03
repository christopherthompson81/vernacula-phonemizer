/**
 * Native Amharic / አማርኛ (am) text phonemizer — canonical IPA, espeak-independent. Ethiopian Semitic, written in
 * the Ge'ez/Fidäl SYLLABARY-abugida: each codepoint is a whole CV syllable (the vowel is baked into the glyph),
 * so the g2p is a flat lookup (fidel.tsv, one Ethiopic codepoint → its CV) rather than a Brahmic matra/virama
 * engine. Two features are UNWRITTEN: GEMINATION (phonemic but unmarked — rendered single, folded vs the referee)
 * and the 6th-order vowel [ɨ], which is epenthetic and DELETED word-finally (ሁለት→hulət) and before a vowel.
 * Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ. See docs/investigations/am_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeGeezG2P } from "../../core/geez.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeAmharicNormalizer } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teenPrefix: string;
    tens: Record<string, string>;
    hundred: string;
    thousand: string;
    million: string;
    billion: string;
}
interface AmharicDef {
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<AmharicDef>(import.meta.url, "amharic.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

/** One Amharic word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion (shared Ge'ez engine). */
export const phonemizeWord = makeGeezG2P(import.meta.url, "fidel.tsv");

// ── Numbers (decimal; Amharic) ────────────────────────────────────────────────
function numberToText(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.teenPrefix} ${NUM.units[n - 10]}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        // tens are keyed "20".."90" — String(t) looked up "2".."9", got undefined, and every ten in the
        // corpus was silently dropped (25 → "amɨst", 1998 → thousand-nine-hundred-EIGHT). 21.7% of FLEURS
        // am_et utterances contain digits, so this was the single largest Amharic corpus defect.
        return NUM.tens[String(t * 10)]! + (u ? ` ${NUM.units[u]}` : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return `${h > 1 ? NUM.units[h] + " " : ""}${NUM.hundred}${r ? " " + numberToText(r) : ""}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return `${th > 1 ? numberToText(th) + " " : ""}${NUM.thousand}${r ? " " + numberToText(r) : ""}`;
    }
    // Scales above ሺ are European loans (ሚሊዮን / ቢሊዮን) and, unlike the bare ሺ / መቶ, KEEP their multiplier at 1 —
    // Omniglot cites 10⁶ as አንድ ሚሊዮን. Nothing above 999 999 was composed before, so 10⁶+ emitted the digit string
    // and the fidel g2p then rendered it as EMPTY IPA.
    for (const [value, scale] of [[1_000_000_000, NUM.billion], [1_000_000, NUM.million]] as const) {
        if (n >= value) {
            const q = Math.floor(n / value), r = n % value;
            return `${numberToText(q)} ${scale}${r ? " " + numberToText(r) : ""}`;
        }
    }
    return String(n);
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return digits;
    return numberToText(n).split(" ").map(phonemizeWord).join(" ");
}

// Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
//
// #562 AUDIT, recorded because it is the known hazard for a script whose punctuation lives inside its own
// Unicode block (Burmese and Khmer were dropping EVERY sentence boundary this way): the letter class here
// ends at ፚ = U+135A, and ። ፣ ፤ ፥ ፦ ፧ ፨ are U+1362–U+1368. They are ABOVE the range, so the letter branch
// cannot swallow them and all 3,391 corpus instances already reach the punctuation branch. Verified, not
// assumed. Do not widen this class to the full block without moving the punctuation branch ahead of it.
const TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

// #562 symbol normalization — Amharic: በመቶ "in a hundred" is THE standard percent construction
// (Amharic media universal, after the number); currency/unit words are the standard loans, emitted in
// Ge'ez script and read by the ordinary fidel g2p.
// MAGNITUDES added by the #562 run: the corpus writes "US$14.7 ቢሊዮን" and "$2.3 ቢልየን", which without the
// magnitude list came out as "…ዶላር ቢሊዮን" (the noun inserted before the written magnitude). ቢልየን is a
// corpus-attested spelling variant of ቢሊዮን and is listed so it is matched, not so it is emitted. No
// `magnitudeConnective`: Amharic takes none (አንድ ሚሊዮን ዶላር). The tier's own `already` guard covers the
// three corpus cases that write ዶላር/ዶላሮች after the sign, so the noun is not doubled.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["በመቶ"],
    currency: { "$": ["ዶላር"], "¥": ["የን"], "£": ["ፓውንድ"] },
    // #586 — `5 km` read as *amɨst ˈʊkm*: no km or m was declared at all. Verified in am_et:
    // ሜትር ×15 "ከፍታ 15 ሜትር ነው", ኪሎ ሜትር ×3 "ሰባ ኪሎ ሜትር ያህል ርቆ ነበር", ኪሎ ግራም ×3 "(16 ኪሎ ግራም) ይመዝናል".
    // NOTED, NOT CHANGED: the corpus writes ኪሎ ሜትር and ኪሎ ግራም with a SPACE, and the ኪሎግራም already declared
    // here occurs ×0. Both are current Amharic and the space does not change the reading, so the closed
    // spelling stays for kg while the corpus's own spaced forms are used for the two new keys — a
    // spelling-preference finding for the sweep, recorded rather than silently harmonised.
    units: { kg: ["ኪሎግራም"], km: ["ኪሎ ሜትር"], m: ["ሜትር"] },
    magnitudes: ["ሚሊዮን", "ቢሊዮን", "ቢልየን", "ትሪሊዮን"],
});

/** #562 text normalization. SYMBOLS is threaded through it — the ordering is load-bearing (normalize.ts §9). */
const NORMALIZE = makeAmharicNormalizer(numberToText, SYMBOLS);

class AmharicPhonemizer implements Phonemizer {
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

/** Build the Amharic phonemizer. `foreign` handles embedded Latin runs. */
export function createAmharic(foreign?: ForeignPhonemizer): Phonemizer {
    return new AmharicPhonemizer(foreign);
}
