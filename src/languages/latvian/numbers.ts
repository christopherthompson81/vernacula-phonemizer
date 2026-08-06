/**
 * Latvian (lv) cardinal number compositor. Returns composed Latvian TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Tens+units are space-separated (divdesmit
 * viens); teens take the -padsmit suffix as one word (vienpadsmit). Hundreds/thousands: (count) simti / tūkstoši.
 * No numeric referee exists → these are the standard Latvian forms.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const { units: UNITS, teens: TEENS, tens: TENS } = N;

/** 0–99 → Latvian text (tens + space + units: divdesmit viens). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${UNITS[u]}`;
}

/** 1–999 → Latvian text. Hundreds: 1→simts, else (count) simti; then the sub-hundred remainder. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100), r = n % 100;
    if (h === 0) return sub100(r);
    const hw = h === 1 ? N.hundred.one : `${sub100(h)} ${N.hundred.many}`;
    return r ? `${hw} ${sub100(r)}` : hw;
}

/** The counted-noun form by Latvian agreement: SINGULAR after a count ending in ...1 (but NOT ...11) — 21, 101 →
 *  tūkstotis; otherwise the genitive-plural (tūkstoši, miljoni). */
function agree(count: number, forms: { one: string; many: string }): string {
    return count % 10 === 1 && count % 100 !== 11 ? forms.one : forms.many;
}

/** A magnitude group: 1 tūkstotis drops the numeral (idiomatic), 1 miljons keeps "viens"; larger counts render via
 *  sub1000 (so 100 000 = simts tūkstoši) + the agreeing noun. NOTE: numerals are MASCULINE-default (viens/divi) —
 *  Latvian 1/2 also inflect for gender (feminine viena/divas), which is context-dependent + unverifiable here → deferred. */
function magnitude(count: number, forms: { one: string; many: string }, keepOne: boolean): string {
    if (count === 1) return keepOne ? `${UNITS[1]} ${forms.one}` : forms.one;
    return `${sub1000(count)} ${agree(count, forms)}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback for out-of-range / over-long numbers. */
export function readDigits(digits: string): string {
    return digits.split("").map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/** A non-negative integer (< 1e9) → space-separated Latvian cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!;
    if (n >= 1e9) return readDigits(String(n));
    const parts: string[] = [];
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(magnitude(mil, N.million, true)); // 1 → "viens miljons"
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(magnitude(th, N.thousand, false)); // 1 → "tūkstotis" (numeral dropped)
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
