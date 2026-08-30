/**
 * Afrikaans (af) cardinal-number → words compositor. Afrikaans uses the Dutch-style UNIT-en-TEN order
 * (21 = een-en-twintig) and joins the sub-100 remainder to hundreds/thousands with "en" (honderd-en-vyf). The words
 * are authored in afrikaans.jsonc; numberToWords returns them space-separated and afrikaans.ts phonemizes each
 * through the g2p, so numbers stay in our canonical convention. Handles 0 … 10⁹-1; digit-by-digit fallback beyond.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1–99 → Afrikaans words. Compound X1–X9 is unit-en-ten (drie-en-twintig → "drie en twintig"). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n < 20) return N.teens[n - 10]!;
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.units[u]} ${N.en} ${N.tens[t]}`;
}

/** 1–999 → words: [unit] honderd [en remainder]; a lone hundred is just "honderd". */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), rest = n % 100;
    const head = (h === 1 ? "" : `${N.units[h]} `) + N.hundred;
    return rest ? `${head} ${N.en} ${below100(rest)}` : head;
}

/**
 * A magnitude group. ⚠ A LONE THOUSAND IS BARE — *duisend*, not "een duisend" — but MILLION AND UP KEEP THE
 * NUMERAL: 1 000 000 is *een miljoen*, and reading it as a bare *miljoen* drops the count entirely. Same split
 * `core/numbers.ts` documents on `bareMagnitude`.
 */
function magnitude(mult: number, word: string, bareAtOne: boolean): string {
    return mult === 1 && bareAtOne ? word : `${below1000(mult)} ${word}`;
}

/** 0 … 10⁹-1 → Afrikaans words; beyond (or unsafe) → digit-by-digit units. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        return (raw ?? String(n)).split("").map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    }
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    if (n >= 1e6) { parts.push(magnitude(Math.floor(n / 1e6), N.million, false)); n %= 1e6; }
    if (n >= 1000) { parts.push(magnitude(Math.floor(n / 1000), N.thousand, true)); n %= 1000; }
    if (n > 0) parts.push(below1000(n));
    return parts.join(" ");
}
