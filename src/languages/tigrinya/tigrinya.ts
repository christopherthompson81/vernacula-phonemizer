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
    thousand: string;
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

// ── Numbers (decimal; Tigrinya) ───────────────────────────────────────────────
function numberToText(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.teenPrefix} ${NUM.units[n - 10]}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return NUM.tens[String(t)]! + (u ? ` ${NUM.units[u]}` : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return `${h > 1 ? NUM.units[h] + " " : ""}${NUM.hundred}${r ? " " + numberToText(r) : ""}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return `${th > 1 ? numberToText(th) + " " : ""}${NUM.thousand}${r ? " " + numberToText(r) : ""}`;
    }
    return String(n);
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToText(n).split(" ").map(phonemizeWord).join(" ");
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
