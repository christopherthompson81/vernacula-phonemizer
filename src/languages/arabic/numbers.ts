/**
 * Arabic number → canonical IPA (Modern Standard Arabic, counting/masculine forms). Emitted as IPA directly
 * (not spelled Arabic) because the g2p needs diacritics that a bare numeral spelling lacks. Structure: ones
 * precede tens joined by wa (٢١ → waːħid wa ʕiʃruːn); hundreds/thousands use construct + dual forms. Covers
 * 0 … <10⁹; gender agreement and rarer construct nuances are deferred. See the shim for the target forms.
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — MSA in arabic.jsonc, with optional per-VARIETY overrides (egyptian.jsonc:
// issue #561 — arz read 80 as MSA θamaːnuːn, with a θ the dialect does not have; Egyptian is tamaniːn).
// A variety table may carry `hundredsFused`, the dialects' fused hundreds (mijːa, miteːn, tultumijːa …),
// which replaces MSA's construct + dual composition below.
export interface ArabicNumberData {
    ones: string[];
    teens: string[];
    tens: string[];
    hundredsConstruct?: string[];
    hundredsFused?: string[];
    connector: string;
    magnitudes: {
        hundred: string;
        hundredDual: string;
        thousand: string;
        thousandDual: string;
        thousandsPlural: string;
        million: string;
        millionDual: string;
        millionsPlural: string;
    };
}
const MSA: ArabicNumberData = MANIFEST.numbers;

/** 0 ≤ n < 100 */
function below100(n: number, d: ArabicNumberData): string {
    if (n < 10) return d.ones[n]!;
    if (n < 20) return d.teens[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? d.tens[t]! : `${d.ones[u]} ${d.connector} ${d.tens[t]}`; // ones precede tens: 21 = waːħid wa ʕiʃruːn
}

/** 1 ≤ n < 1000 */
function below1000(n: number, d: ArabicNumberData): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    let head = "";
    if (h >= 1 && d.hundredsFused) head = d.hundredsFused[h]!; // dialect fused forms (mijːa, miteːn, tultumijːa)
    else if (h === 1) head = d.magnitudes.hundred;
    else if (h === 2) head = d.magnitudes.hundredDual;
    else if (h >= 3) head = `${d.hundredsConstruct![h]}${d.magnitudes.hundred}`; // θalaːθumiʔa
    if (h === 0) return below100(n, d);
    return r ? `${head} ${d.connector} ${below100(r, d)}` : head;
}

/** 1 ≤ n < 10⁶ */
function below1e6(n: number, d: ArabicNumberData): string {
    if (n < 1000) return below1000(n, d);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    let head: string;
    if (th === 1) head = d.magnitudes.thousand;
    else if (th === 2) head = d.magnitudes.thousandDual;
    else if (th <= 10)
        head = `${below100(th, d)} ${d.magnitudes.thousandsPlural}`; // 3–10 thousand: plural ʔaːlaːf
    else head = `${below1000(th, d)} ${d.magnitudes.thousand}`;
    return r ? `${head} ${d.connector} ${below1000(r, d)}` : head;
}

/** Non-negative integer (< 10⁹) → Arabic IPA words. Larger / invalid → digit-by-digit (digits only). */
export function numberToIpa(n: number, data?: ArabicNumberData): string {
    const d = data ?? MSA;
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        return [...String(Math.abs(n))]
            .map((x) => d.ones[Number(x)])
            .filter(Boolean)
            .join(" ");
    }
    if (n === 0) return d.ones[0]!; // sˤifr
    if (n < 1e6) return below1e6(n, d);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    let head: string;
    if (m === 1) head = d.magnitudes.million;
    else if (m === 2)
        head = d.magnitudes.millionDual; // dual
    else if (m <= 10)
        head = `${below100(m, d)} ${d.magnitudes.millionsPlural}`; // 3–10 million: plural malaːjiːn
    else head = `${below1000(m, d)} ${d.magnitudes.million}`;
    return r ? `${head} ${d.connector} ${below1e6(r, d)}` : head;
}
