/**
 * Cebuano cardinal number → words. Native Cebuano: tens are irregular ka-…-an forms (explicit table), compounds
 * join tens-first with the ligature "ug" (napulo ug usa = 11, kaluhaan ug usa = 21); hundreds/thousands use the
 * "ka" ligature (duha ka gatos). Covers 0 … <10⁶. Spanish numerals (uno, dos) common in speech are not modelled.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface CebNumbers {
    units: string[];
    tens: string[];
    connector: string;
    ligature: string;
    hundred: string;
    thousand: string;
    million: string;
}
const N = loadManifest<{ numbers: CebNumbers }>(import.meta.url, "cebuano.jsonc").numbers;

/** 1 ≤ n < 100 (tens-first: kaluhaan ug usa). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? N.tens[t]! : `${N.tens[t]} ${N.connector} ${N.units[u]}`;
}

/** A "X ka <scale>" group: usa ka gatos, duha ka libo. */
function kaGroup(count: number, scale: string): string {
    return `${count === 1 ? N.units[1] : below1000(count)} ${N.ligature} ${scale}`;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = kaGroup(h, N.hundred);
    return r ? `${hundred} ${N.connector} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁶) → Cebuano words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e6)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // sero
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = kaGroup(th, N.thousand);
    return r ? `${thousand} ${N.connector} ${below1000(r)}` : thousand;
}
