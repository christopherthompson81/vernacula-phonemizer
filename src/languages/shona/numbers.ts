/**
 * Shona cardinal number → words (space-separated; each runs through the g2p). Shona counting uses gumi (10),
 * makumi (tens, "tens of"), zana (100), churu (1000), joined with ne ("and"). Simplified counting form (the
 * full noun-class concord agreement is contextual and not modelled): gumi ne motsi (11), makumi maviri (20),
 * zana (100). Covers 0 … <10⁶; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referee is
 * word-only) — a best-effort composer.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100. */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = t === 1 ? N.ten : `${N.tens} ${N.units[t]}`;
    return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? N.hundred : `${N.hundred} ${N.units[h]}`;
    return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁶) → Shona words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${N.thousand} ${below1000(th)}`;
    return r ? `${thousand} ${N.and} ${below1000(r)}` : thousand;
}
