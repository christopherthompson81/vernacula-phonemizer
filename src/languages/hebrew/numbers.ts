/**
 * Hebrew (he) cardinal-number → IPA compositor. Semitic gendered structure (like Arabic's numbers.ts), but the
 * number WORDS are authored with niqqud in hebrew.jsonc and rendered by the deterministic rule g2p
 * (phonemizeWord) — the Persian pattern — so numbers stay consistent with the rest of Hebrew's canonical IPA.
 *
 * Register: the FEMININE citation forms (how a bare number is read aloud abstractly). Gender/construct handled where
 * obligatory: מֵאָה hundred is feminine (3-9×100 → reduced fem `teensOnes` + מֵאוֹת); אֶלֶף/מִילְיוֹן are masculine, so
 * their MULTIPLIER agrees masculine (2× → dual/construct, 3-10× thousand → `thousandsConstruct` + אֲלָפִים, ≥11× → a
 * masculine sub-1000 multiplier + the singular magnitude word; 3-10× million → `unitsM`); 200/2000 are the duals.
 *
 * The connector וְ is INTERNAL — it prefixes the final small cardinal of a group (עֶשְׂרִים וְאַחַת → …veʔaχat; מֵאָה
 * וְעֶשֶׂר) and NEVER a magnitude word (מֵאָה אֶלֶף has no vav; עֶשְׂרִים וְאֶחָד אֶלֶף carries it inside the multiplier). The
 * proclitic וְ realises its sheva-na → [ve] (hebrew.ts). The u-/va- morphophonology before labials is not modelled.
 * Fully correct across 0–9999 + round magnitudes + millions/milliards; very large MIXED numbers (a single-term
 * hundreds remainder after a magnitude, or an 11-19× teen multiplier) may carry a minor extra vav / feminine teen.
 * Handles 0 … 10¹²-1; beyond that (or an unsafe int) it falls back to reading the TOKEN's digits one-by-one. Decimals
 * ("3.14") read as integer · נְקֻדָּה · fractional digits one-by-one.
 */
import { digitIndex } from "../../core/numbers.ts";
import { phonemizeWord } from "./hebrew.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** Prefix the connector וְ to a term's head word (the internal "and"). */
const withVav = (term: string[]): string[] => [N.and + term[0]!, ...term.slice(1)];

/** Concatenate a higher group with a lower remainder, adding the וְ connector on the remainder's head iff the
 *  remainder is a single term — a compound remainder (tens + unit) already carries the vav on its final unit. */
const joinRem = (higher: string[][], lower: string[][]): string[][] =>
    higher.concat(lower.length === 1 ? [withVav(lower[0]!)] : lower);

/** 0–99 → terms (each term = one indivisible cardinal). `masc` picks masculine units (a magnitude multiplier). A
 *  compound X1–X9 is two terms with the vav on the unit; a teen is one two-word term. */
function sub100(n: number, masc: boolean): string[][] {
    const U = masc ? N.unitsM : N.unitsF;
    if (n < 10) return [[U[n]!]];
    if (n === 10) return [[N.ten]];
    if (n < 20) return [[N.teensOnes[n - 10]!, N.teenSuffix]];
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? [[N.tens[t]!]] : [[N.tens[t]!], [N.and + U[u]!]];
}

/** 0–999 → terms. Hundreds: 1 מֵאָה, 2 מָאתַיִם (dual), 3-9 reduced-fem unit + מֵאוֹת; then the sub-100 remainder. */
function sub1000(n: number, masc: boolean): string[][] {
    if (n < 100) return sub100(n, masc);
    const h = Math.floor(n / 100), rest = n % 100;
    const hs: string[][] = h === 1 ? [[N.hundred]] : h === 2 ? [[N.twoHundred]] : [[N.teensOnes[h]!, N.hundredsPlural]];
    return rest ? joinRem(hs, sub100(rest, masc)) : hs;
}

/** A magnitude group: `mult` copies of `word` (masculine agreement). 1 → [word]; 2 → construct שְׁנֵי + word;
 *  3-9 → masculine unit + word; ≥10 → a sub-1000 multiplier + the singular word (no vav on `word`).
 *  ⚠ THE UNIT ARM STOPS AT 9, AND 10 IS NOT AN OFF-BY-ONE THAT WENT UNNOTICED — IT THREW. `unitsM` is the
 *  masculine units 0-9 and this arm read `unitsM[10]`, which is `undefined`: `phonemize("10000000", "he")`
 *  died with *Cannot read properties of undefined (reading 'normalize')*, and so did every value in
 *  10,000,000-10,999,999 and 10,000,000,000-10,999,999,999. Found while porting to C#, where the same index
 *  raises IndexOutOfRangeException. There is no masculine ten in this data model BY CONSTRUCTION — `sub100`'s
 *  own `n === 10` arm ignores `masc` and returns the feminine עֶשֶׂר — so ten routes there like every other
 *  multiplier the unit arm does not cover, giving *ʔeseʁ miljon*. That is the same feminine leakage the
 *  module header already records for the 11-19 multipliers, not a new register choice, and it needs no
 *  number word this manifest does not carry. */
function magnitude(mult: number, word: string): string[][] {
    if (mult === 1) return [[word]];
    if (mult === 2) return [[N.twoConstruct, word]];
    if (mult < 10) return [[N.unitsM[mult]!, word]];
    return sub1000(mult, true).concat([[word]]);
}

/** Thousands group: 1 אֶלֶף, 2 אַלְפַּיִם (dual), 3-10 construct + אֲלָפִים, ≥11 masculine multiplier + singular אֶלֶף. */
function thousands(k: number): string[][] {
    if (k === 1) return [[N.thousand]];
    if (k === 2) return [[N.twoThousand]];
    if (k <= 10) return [[N.thousandsConstruct[k]!, N.thousandsPlural]];
    return sub1000(k, true).concat([[N.thousand]]);
}

/** 0 … 10¹²-1 → terms (citation register: the final remainder reads feminine; magnitude multipliers read masculine). */
function compose(n: number): string[][] {
    if (n < 1000) return sub1000(n, false);
    if (n < 1e6) { const k = Math.floor(n / 1000), r = n % 1000; const g = thousands(k); return r ? joinRem(g, sub1000(r, false)) : g; }
    if (n < 1e9) { const m = Math.floor(n / 1e6), r = n % 1e6; const g = magnitude(m, N.million); return r ? joinRem(g, compose(r)) : g; }
    const b = Math.floor(n / 1e9), r = n % 1e9;
    const g = magnitude(b, N.milliard);
    return r ? joinRem(g, compose(r)) : g;
}

/** An integer → its ordered niqqud number-words. Digit-by-digit past 10¹²-1 or unsafe — from `raw`, the
 *  TOKEN's own digits, because above 2^53 the double the caller parsed has already lost them (#1059). */
function integerWords(n: number, raw?: string): string[] {
    if (n === 0) return [N.unitsF[0]!];
    if (n >= 1e12 || !Number.isSafeInteger(n))
        return [...(raw ?? String(n))].map((d) => N.unitsF[digitIndex(d)] ?? d);
    return compose(n).flat();
}

/** Phonemize a digit token (integer or decimal) to Modern Israeli IPA via the rule g2p. */
export function numberToIpa(digits: string): string {
    const dot = digits.indexOf(".");
    if (dot < 0) return integerWords(Number(digits), digits).map(phonemizeWord).join(" ");
    const intWords = integerWords(Number(digits.slice(0, dot)), digits.slice(0, dot));
    const fracWords = [...digits.slice(dot + 1)].map((d) => N.unitsF[Number(d)]!); // fractional digits read one-by-one
    return [...intWords, N.point, ...fracWords].map(phonemizeWord).join(" ");
}
