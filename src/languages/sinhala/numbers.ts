/**
 * Sinhala (si) cardinal number compositor. AUTHORED, not shim-derived: espeak's si number path is broken (6 and
 * 7 both render as "දෙසිය එක" = 200·1, and දහස/1000 is truncated to ˈɐhəs), so there is no reliable gold to match.
 * These are the standard Sinhala cardinals; magnitudes ≥100 use the analytic multiplier form (දෙක සියය "two
 * hundred") rather than the fused colloquial forms, which keeps the morphology unambiguous. The words are
 * phonemized by the g2p, so the IPA stays consistent with the word engine.
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in sinhala.jsonc; the analytic-multiplier compositor is the algorithm.
const N = MANIFEST.numbers;
const UNITS = N.units,
    TEENS = N.teens,
    TENS_WORD = N.tensWord,
    TENS_STEM = N.tensStem,
    M = N.magnitudes;

/** A non-negative integer → space-separated Sinhala cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        return u === 0 ? TENS_WORD[t]! : TENS_STEM[t]! + UNITS[u]!;
    }
    const compose = (
        count: number,
        magnitude: string,
        unit: number,
    ): string => {
        const head =
            count === 1 ? magnitude : `${numberToWords(count)} ${magnitude}`;
        const rest = n % unit;
        return rest === 0 ? head : `${head} ${numberToWords(rest)}`;
    };
    if (n < 1000) return compose(Math.floor(n / 100), M.hundred, 100);
    if (n < 100000) return compose(Math.floor(n / 1000), M.thousand, 1000);
    if (n < 10000000) return compose(Math.floor(n / 100000), M.lakh, 100000);
    return compose(Math.floor(n / 1000000), M.million, 1000000);
}
