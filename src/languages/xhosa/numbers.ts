/**
 * Xhosa (xh) cardinal number compositor — agglutinative Nguni, the same algorithm as Zulu (units 1–5 have
 * standalone ku-/connective na-/multiplier ama- stems; 6–9 are isi- nouns; tens/hundreds/thousands are noun
 * classes with an ama-/izi- multiplier), reading the Xhosa number words (2 = -bini, 6–9 differ from Zulu).
 * Returns space-separated Xhosa TEXT; the phonemizer runs each word through the shared g2p.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const KU = N.ku,
    NA = N.na,
    AMA = N.ama;

/** A non-negative integer → space-separated Xhosa cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return N.zero;
    if (n >= 1000000) {
        const m = Math.floor(n / 1000000),
            rem = n % 1000000;
        const mil = m === 1 ? N.million.one : `${N.million.many} ${AMA[m] ?? numberToWords(m)}`;
        return rem ? `${mil} ${numberToWords(rem)}` : mil;
    }
    const parts: string[] = [];
    const th = Math.floor(n / 1000),
        h = Math.floor((n % 1000) / 100),
        t = Math.floor((n % 100) / 10),
        u = n % 10;
    if (th === 1) parts.push(N.thousand.one);
    else if (th >= 2) parts.push(N.thousand.many, AMA[th] ?? numberToWords(th));
    if (h === 1) parts.push(N.hundred.one);
    else if (h >= 2) parts.push(N.hundred.many, AMA[h]!);
    if (t === 1) parts.push(N.ten.one);
    else if (t >= 2) parts.push(N.ten.many, AMA[t]!);
    if (u > 0) parts.push(parts.length === 0 ? KU[u]! : NA[u]!);
    return parts.join(" ");
}
