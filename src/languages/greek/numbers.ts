/**
 * Modern Greek cardinal number → words (space-separated; each runs through the g2p). Simplified counting form
 * (δέκα = 10, tens[]/hundreds[] tables, χίλια = 1000); the full gender/case agreement is contextual and not
 * modelled. Covers 0 … <10⁶; larger / non-finite → digit-by-digit. Numbers are unmeasured (the referees are
 * word-only) — best-effort.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = N.tens[t]!;
    return u ? `${tens} ${N.units[u]}` : tens;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = N.hundreds[h]!;
    return r ? `${hundred} ${below100(r)}` : hundred;
}

export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} χιλιάδες`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}
