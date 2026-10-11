/**
 * Russian number → words (cardinals, nominative). Space-separated words that each read through the stress
 * dictionary + g2p. Covers 0 … <10⁹. Gender/case agreement is simplified to the nominative base forms.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in russian.jsonc; the compositor below is the algorithm.
const N = MANIFEST.numbers;
const ONES = N.ones,
    TENS = N.tens,
    HUNDREDS = N.hundreds;

/** Plural form selector for Russian quantities (1 → one, 2–4 → few, else → many). */
function plural(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10,
        mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
    const parts: string[] = [];
    const h = Math.floor(n / 100),
        t = Math.floor((n % 100) / 10),
        u = n % 10;
    if (h) parts.push(HUNDREDS[h]!);
    if (t >= 2) {
        parts.push(TENS[t]!);
        if (u) parts.push(ONES[u]!);
    } else if (t === 1) parts.push(ONES[10 + u]!);
    else if (u) parts.push(ONES[u]!);
    return parts.join(" ");
}

/** Non-negative integer (< 10⁹) → Russian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))]
            .map((d) => ONES[digitIndex(d)] ?? d)
            .join(" ");
    if (n < 20) return ONES[n]!;
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (mil)
        parts.push(
            below1000(mil),
            plural(mil, N.million[0]!, N.million[1]!, N.million[2]!),
        );
    if (th === 1) {
        // ⚠ A LONE THOUSAND IS BARE `тысяча`, the reading a news reader gives a year (1939 → тысяча девятьсот
        //   тридцать девять). `одна тысяча` is the formal register of a cheque or a contract, and it made every
        //   year from 1000 to 1999 read that way. Only the group that IS one drops it: 21000 keeps двадцать
        //   одна тысяча, where одна is the agreeing last element of a compound.
        parts.push(N.thousand[0]!);
    } else if (th) {
        // тысяча is feminine → 1 → одна, 2 → две
        const thWords = below1000(th)
            .replace(/один$/, N.thousandFeminine.one)
            .replace(/два$/, N.thousandFeminine.two); // тысяча is feminine (JS \b fails on Cyrillic)
        parts.push(
            thWords,
            plural(th, N.thousand[0]!, N.thousand[1]!, N.thousand[2]!),
        );
    }
    if (r) parts.push(below1000(r));
    return parts.join(" ");
}

/** The cardinal's oblique-case slots (manifest: numbers.genitive, numbers.instrumental). */
export type CardinalCase = "genitive" | "instrumental";

/**
 * 1 ≤ n < 1000 → the cardinal in an oblique case: тридцать пять → тридцати пяти, тридцать четыре →
 * тридцатью четырьмя. ⚠ EVERY ELEMENT DECLINES in a Russian cardinal (unlike the ordinal, where only the last
 * does), so this is the nominative compositor over another set of the same slots. undefined outside the range:
 * a thousand declines as a noun (тысячи, тысячей), which is not attempted.
 */
export function cardinalInCase(n: number, kase: CardinalCase): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1 || n >= 1000) return undefined;
    const t = N[kase];
    const parts: string[] = [];
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h) parts.push(t.hundreds[h]!);
    if (r >= 20) {
        parts.push(t.tens[Math.floor(r / 10)]!);
        if (r % 10) parts.push(t.ones[r % 10]!);
    } else if (r) parts.push(t.ones[r]!);
    return parts.join(" ");
}
