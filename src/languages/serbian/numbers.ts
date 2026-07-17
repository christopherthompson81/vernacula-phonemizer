/**
 * Serbian cardinal number → words (space-separated; each word runs through the g2p). Hundreds are irregular
 * (dvesta/trista); tens+units are space-joined (dvadeset jedan). Thousands take the Slavic count agreement
 * (1 hiljadu, 2–4 hiljade, 5+ hiljada). Covers 0 … <10⁹.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100. */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n < 20) return N.teens[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.tens[t]} ${N.units[u]}`;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${N.hundreds[h]} ${below100(r)}` : N.hundreds[h]!;
}

/** Slavic count agreement: a count ending in 1 (not 11) → the nominative-singular "one" form (dvadeset jedan
 *  milion), ending in 2–4 (not 12–14) → "few", else "many". */
function agree(count: number, m: { one: string; few?: string; many: string }): string {
    const d = count % 10,
        dd = count % 100;
    if (d === 1 && dd !== 11) return m.one;
    if (m.few && d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return m.few;
    return m.many;
}

/** Non-negative integer (< 10⁹) → Serbian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // nula
    if (n < 1000) return below1000(n);
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (mil) parts.push(`${below1000(mil)} ${agree(mil, N.million)}`);
    // The thousands group of exactly 1 is the standalone "hiljadu" (1000, 1001000, …); ≥2 (incl. 21, 31, …)
    // keeps the multiplier + the agreeing form (dvadeset jedna → …jedan hiljada; dve hiljade; pet hiljada).
    if (th) parts.push(th === 1 ? N.thousand.standalone! : `${below1000(th)} ${agree(th, N.thousand)}`);
    if (r) parts.push(below1000(r));
    return parts.join(" ");
}
