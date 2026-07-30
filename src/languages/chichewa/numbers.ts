/**
 * Chichewa cardinal number → words (space-separated; each runs through the g2p). Chichewa counts 6–9 as
 * "5 and N" (zisanu ndi chimodzi = 6) and the tens above 50 the same way — 60 is literally "five tens and one (ten)".
 * Covers 0 … <10⁶; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referees are word-only).
 *
 * NOUN-CLASS CONCORD (the reason there are two unit series — see the "numbers" comment in chichewa.jsonc):
 * a bare numeral is spoken in its class-8/10 citation form (`units`: chimodzi, ziwiri, …) but a numeral acting as
 * the MULTIPLIER of a class-6 magnitude noun — makumi "tens", mazana "hundreds" — takes the class-6 series
 * (`classSix`: limodzi, awiri, …). Using `units` for both made 60 (*makumi zisanu ndi chimodzi) collide with 51.
 * The class-8 magnitude zikwi "thousands" legitimately takes the same zi- series as `units`.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100. Tens = makumi + the class-6 multiplier; 6–9 tens are themselves "5 tens and N". */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = t === 1 ? N.ten : `${N.tens} ${N.classSix[t]}`;
    return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
}

/** 1 ≤ n < 1000. 100 = zana (class 5); 200–900 = mazana (class 6) + the class-6 multiplier. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.hundreds} ${N.classSix[h]}`;
    return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁶) → Chichewa words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    // 1000 = chikwi (class 7); 2000+ = zikwi (class 8) + multiplier, which is the same zi- series as `units`.
    const thousand = th === 1 ? N.thousand : `${N.thousands} ${below1000(th)}`;
    return r ? `${thousand} ${N.and} ${below1000(r)}` : thousand;
}
