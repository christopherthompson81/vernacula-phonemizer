/**
 * Hausa cardinal number → words. Units/tens are lexicalised; hundreds (ɗari) and thousands (dubu) compound
 * with "da" (and). A basic compositor for the common range; tone is added downstream by the g2p lexicon.
 */
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in hausa.jsonc; the composition logic below is the algorithm.
const N = MANIFEST.numbers;
const { ones: ONES, tens: TENS } = N;

function below100(n: number): string[] {
    if (n < 10) return n === 0 ? [] : [ONES[n]!];
    if (n < 20)
        return n === 10
            ? [TENS[1]!]
            : [TENS[1]!, N.teensConnector, ONES[n - 10]!]; // 11–19: goma sha X
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? [TENS[t]!] : [TENS[t]!, N.connector, ONES[u]!];
}
function below1000(n: number): string[] {
    const h = Math.floor(n / 100),
        r = n % 100;
    const parts: string[] = [];
    if (h > 0) {
        parts.push(N.hundred);
        if (h > 1) parts.push(ONES[h]!);
    }
    if (r > 0) {
        if (h > 0) parts.push(N.connector);
        parts.push(...below100(r));
    }
    return parts;
}

/** Non-negative integer → Hausa words. */
export function numberToWords(n: number): string {
    if (!Number.isFinite(n) || n < 0 || n >= 1e12) return "";
    if (n === 0) return ONES[0]!; // sifili
    // Magnitude-first, largest scale first (Hausa says the scale word then its multiplier: dubu biyu = 2 000).
    // The chain previously stopped at dubu and fed the whole quotient to below1000(), which indexes ONES[h] with
    // h = ⌊q/100⌋ — for q ≥ 1000 that is ONES[10]/ONES[10000], i.e. undefined, so 100 000 / 10⁶ / 10⁹ all collapsed
    // to the SAME output ("dubu ɗari …"). Each scale now consumes its own decade band and recurses on the rest.
    const SCALES: [number, string][] = [
        [1_000_000_000, N.billion], [1_000_000, N.million], [1000, N.thousand],
    ];
    for (const [value, scale] of SCALES) {
        if (n >= value) {
            const q = Math.floor(n / value),
                rest = n % value;
            const parts: string[] = [scale];
            if (q > 1) parts.push(...numberToWords(q).split(" ")); // the multiplier follows its scale word
            if (rest > 0) parts.push(N.connector, ...numberToWords(rest).split(" "));
            return parts.join(" ");
        }
    }
    return below1000(n).join(" ");
}
