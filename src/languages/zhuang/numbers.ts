/**
 * Zhuang cardinal number → words (space-separated; each runs through the g2p). Zhuang is decimal: tens are
 * unit+cib (ngeih cib = 20), units follow (ngeih cib it = 21); hundreds/thousands multiply (sam bak = 300).
 * Covers 0 … <10⁶.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100. */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = t === 1 ? N.ten : `${N.units[t]} ${N.ten}`;
    return u ? `${tens} ${N.units[u]}` : tens;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = `${N.units[h]} ${N.hundred}`;
    return r ? `${hundred} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁶) → Zhuang words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // lingz
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = `${below1000(th)} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}
