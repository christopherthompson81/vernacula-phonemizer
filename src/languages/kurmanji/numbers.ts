/**
 * Kurmanji cardinal number → words (space-separated; each runs through the g2p). Kurmanji joins with "û" (and):
 * 21 → bîst û yek; hundreds/thousands are multiplied (du sed, sê hezar). Covers 0 … <10⁹.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100 (tens û units). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n < 20) return N.teens[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.tens[t]} ${N.connector} ${N.units[u]}`;
}

/** 1 ≤ n < 1000 (du sed û bîst). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.units[h]} ${N.hundred}`;
    return r ? `${hundred} ${N.connector} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → Kurmanji words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // sifir
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (mil) parts.push(`${mil === 1 ? N.units[1] : below1000(mil)} ${N.million}`);
    if (th) parts.push(`${th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`}`);
    if (r) parts.push(below1000(r));
    return parts.join(` ${N.connector} `);
}
