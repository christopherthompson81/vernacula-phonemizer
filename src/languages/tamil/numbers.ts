/**
 * Tamil cardinal number → words (space-separated), Indian grouping (ஆயிரம் 10³ / லட்சம் 10⁵ / கோடி 10⁷).
 *
 * The thing that makes Tamil different from the Indo-Aryan neighbours already done (hi/bn/ur) is that the
 * compounding is SANDHI, not concatenation: a numeral part changes shape depending on whether anything
 * follows it. நூறு "100" but நூற்றி "100 and…"; ஆயிரம் "1000" but ஆயிரத்து "1000 and…"; and 200/300/900
 * are fused stems (இருநூறு, முந்நூறு, தொள்ளாயிரம்), not "two hundred". So each level picks between a FREE
 * form and a COMBINING form, and 11–19 are suppletive. All of it is authored DATA in tamil.jsonc; this
 * file is only the compositor.
 *
 * evidence: before this, every one of the 660 numerals in the ta_in corpus went through the naive
 * concatenating path — 1995 read *ஒன்று ஆயிரம் ஒன்பது நூறு தொண்ணூறு ஐந்து instead of ஆயிரத்து
 * தொள்ளாயிரத்து தொண்ணூற்றி ஐந்து.
 */
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in tamil.jsonc; the Indian-grouping compositor is the algorithm.
const N = MANIFEST.numbers;
const ONES = N.units,
    TENS = N.tens,
    TEENS = N.teens,
    TENS_C = N.tensCombining,
    HUND = N.hundreds,
    HUND_C = N.hundredsCombining,
    THOU = N.thousands,
    THOU_C = N.thousandsCombining,
    M = N.magnitudes;

/** 1–99. `10 + u` is suppletive (பன்னிரண்டு); 21–99 is the ten's OBLIQUE form plus the unit. */
function below100(n: number): string[] {
    if (n <= 0) return [];
    if (n < 10) return [ONES[n]!];
    if (n < 20) return n === 10 ? [TENS[1]!] : [TEENS[n - 11]!];
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? [TENS[t]!] : [TENS_C[t]!, ONES[u]!];
}

/** 1–999. The hundred is a fused stem, and takes its oblique form when a remainder follows. */
function below1000(n: number): string[] {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(r);
    return r === 0 ? [HUND[h]!] : [HUND_C[h]!, ...below100(r)];
}

/**
 * The thousands group. 1–10 thousand are single fused words (ஆயிரம் … பத்தாயிரம்); above that Tamil fuses
 * the count into the same word (23,000 = இருபத்து மூவாயிரம்), approximated here as the ten's oblique plus
 * the fused thousand (இருபத்தி மூவாயிரம்) — the same joint, one degree less contracted. For counts of 100+
 * the count is spelled out before a free ஆயிரம்/ஆயிரத்து.
 */
function thousands(count: number, hasRemainder: boolean): string[] {
    const fused = hasRemainder ? THOU_C : THOU;
    const bare = hasRemainder ? M.thousandCombining : M.thousand;
    if (count <= 10) return [fused[count]!];
    if (count < 20) return [TEENS[count - 11]!, bare];
    if (count < 100) {
        const t = Math.floor(count / 10),
            u = count % 10;
        return u === 0 ? [TENS[t]!, bare] : [TENS_C[t]!, fused[u]!];
    }
    return [...below1000(count), bare];
}

/**
 * Non-negative integer → Tamil words.
 *
 * ⚠ THE CRORE IS THE TOP MAGNITUDE AND ITS COUNT IS CAPPED AT 999, so 10¹⁰ is the ceiling. Above it
 * `below1000(crore)` indexed past `HUND` — and the two engines FAILED DIFFERENTLY, which is the worst
 * shape a shared bug can take: JS yields `undefined`, `Array.join` renders it as the empty string, and
 * 10¹⁰, 10¹¹ and 10¹² all read as the bare word *கோடி* — three different quantities, one reading, no
 * error. .NET throws `IndexOutOfRangeException` on the same input. Neither is acceptable and the goldens
 * could not see either: no corpus row is that large. Digit-at-a-time above the ceiling, as cs and jv do.
 */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n === 0) return ONES[0]!;
    if (n >= 1e10) return [...String(n)].map((d) => ONES[Number(d)]!).join(" ");
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thou = Math.floor(n / 1000);
    n %= 1000;
    // A magnitude noun takes the attributive ஒரு, never the free cardinal ஒன்று: ஒரு லட்சம், ஒரு கோடி.
    const withOne = (c: number): string[] => (c === 1 ? [M.one] : below1000(c));
    if (crore > 0) parts.push(...withOne(crore), lakh + thou + n > 0 ? M.croreCombining : M.crore);
    if (lakh > 0) parts.push(...withOne(lakh), thou + n > 0 ? M.lakhCombining : M.lakh);
    if (thou > 0) parts.push(...thousands(thou, n > 0));
    parts.push(...below1000(n));
    return parts.join(" ");
}

/**
 * The ORDINAL/oblique stem of a cardinal word, used by normalize.ts to build N-ஆம் and N-ஆவது. Tamil
 * forms these by attaching the suffix to the LAST word of the cardinal with a regular euphonic change —
 * 15ஆம் is பதினைந்தாம், one word, not *பதினைந்து ஆம் (which reaches the g2p as a stray syllable [aːm]).
 *
 * Three cases cover every word the compositor above can emit finally:
 *   -ு  → drop it            ஒன்று → ஒன்ற-,  பத்து → பத்த-,  தொண்ணூறு → தொண்ணூற-,  நூறு → நூற-
 *   -ம் → drop the virama    ஆயிரம் → ஆயிரம-,  தொள்ளாயிரம் → தொள்ளாயிரம-,  லட்சம் → லட்சம-
 *   -ி  → insert the glide ய   கோடி → கோடிய-
 */
export function ordinalStem(word: string): string | undefined {
    if (word.endsWith("ு")) return word.slice(0, -1); // ◌ு
    if (word.endsWith("ம்")) return word.slice(0, -1); // ம் → ம
    if (word.endsWith("ி")) return `${word}ய`; // ◌ி + ய
    return undefined;
}
