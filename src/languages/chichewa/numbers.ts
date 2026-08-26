/**
 * Chichewa cardinal number → words (space-separated; each runs through the g2p). Chichewa counts 6–9 as
 * "5 and N" (zisanu ndi chimodzi = 6) and the tens above 50 the same way — 60 is literally "five tens and one (ten)".
 * Covers 0 … <10¹²; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referees are word-only).
 *
 * NOUN-CLASS CONCORD (the reason there are two unit series — see the "numbers" comment in chichewa.jsonc):
 * a bare numeral is spoken in its class-8/10 citation form (`units`: chimodzi, ziwiri, …) but a numeral acting as
 * the MULTIPLIER of a class-6 magnitude noun — makumi "tens", mazana "hundreds" — takes the class-6 series
 * (`classSix`: limodzi, awiri, …). Using `units` for both made 60 (*makumi zisanu ndi chimodzi) collide with 51.
 * The class-8 magnitude zikwi "thousands" legitimately takes the same zi- series as `units`.
 *
 * ⚠ THE CONCORD REACHES INSIDE THE MULTIPLIER, which is why `below100`/`below1000` take a series parameter.
 * ny.wikipedia writes "mamiliyoni asanu ndi anayi" (9 000 000) — the class-6 a- series in BOTH slots of the 5+4
 * compound, not just on its head. `makumi`/`mazana` still take `classSix` unconditionally: they agree with
 * themselves, not with the counted noun. Only the final unit slot varies, so `zikwi` passing `units` reproduces
 * every pre-existing thousands reading byte for byte.
 *
 * ⚠ WORD ORDER — the magnitude noun comes FIRST and the multiplier follows it (zikwi ziwiri, mamiliyoni awiri,
 * miliyoni imodzi), all five spelled-out ny.wikipedia instances and no counter-example. The corpus's `5 miliyoni`
 * is NOT a counter-example: that is a DIGIT beside a word, the orthographic convention borrowed with the numeral
 * glyphs. Text that keeps its digits keeps that order — which is exactly why `magnitudes` stays withdrawn from
 * the shared symbol tier in chichewa.ts ($ 350 miliyoni → madola 350 miliyoni). Same grammar, two spellings.
 *
 * ⚠ 10¹² IS THE CEILING BECAUSE NO TRILLION WORD IS ATTESTED (0 tokens under six spellings on ny.wikipedia; the
 * one web hit transliterates an English phrase whole). Leaving it unauthored is deliberate — see chichewa.jsonc.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/**
 * 1 ≤ n < 100, with `series` supplying the UNIT slot's concord (`units` for a class-8/10 head, `classSix` for a
 * class-6 one). Tens = makumi + the class-6 multiplier, always; 6–9 tens are themselves "5 tens and N".
 */
function below100(n: number, series: string[]): string {
    if (n < 10) return series[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = t === 1 ? N.ten : `${N.tens} ${N.classSix[t]}`;
    return u ? `${tens} ${N.and} ${series[u]}` : tens;
}

/** 1 ≤ n < 1000. 100 = zana (class 5); 200–900 = mazana (class 6) + the class-6 multiplier. */
function below1000(n: number, series: string[]): string {
    if (n < 100) return below100(n, series);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.hundreds} ${N.classSix[h]}`;
    return r ? `${hundred} ${N.and} ${below100(r, series)}` : hundred;
}

/**
 * A class-9 loan magnitude (miliyoni / biliyoni): singular takes the class-9 concord `imodzi`, plural is the
 * ma- form and takes the class-6 multiplier series. 1 ≤ count < 1000.
 */
function loanMagnitude(count: number, singular: string, plural: string): string {
    return count === 1 ? `${singular} ${N.classNineOne}` : `${plural} ${below1000(count, N.classSix)}`;
}

/** Non-negative integer (< 10¹²) → Chichewa words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    const b = Math.floor(n / 1e9);
    const m = Math.floor(n / 1e6) % 1000;
    const th = Math.floor(n / 1000) % 1000;
    const r = n % 1000;
    const parts: string[] = [];
    if (b) parts.push(loanMagnitude(b, N.billion, N.billions));
    if (m) parts.push(loanMagnitude(m, N.million, N.millions));
    // 1000 = chikwi (class 7); 2000+ = zikwi (class 8) + multiplier, which is the same zi- series as `units`.
    if (th) parts.push(th === 1 ? N.thousand : `${N.thousands} ${below1000(th, N.units)}`);
    if (r) parts.push(below1000(r, N.units));
    return parts.join(` ${N.and} `);
}
