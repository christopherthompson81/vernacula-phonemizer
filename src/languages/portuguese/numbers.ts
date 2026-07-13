/**
 * Portuguese number → words (European convention). Space-separated words with the "e" connector. Covers
 * 0 … <10⁹. Decimals read "vírgula" + digits (handled by the caller).
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in portuguese.jsonc; the "e"-connector compositor is the algorithm.
const N = MANIFEST.numbers;
const SMALL = N.small, TENS = N.tens, HUNDREDS = N.hundreds;
const E = N.connector; // "e"

/** 0 ≤ n < 100 */
function below100(n: number): string {
  if (n < 20) return SMALL[n]!;
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? TENS[t]! : `${TENS[t]} ${E} ${SMALL[u]}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  if (n < 100) return below100(n);
  if (n === 100) return N.hundredExact;
  const h = Math.floor(n / 100), r = n % 100;
  return r ? `${HUNDREDS[h]} ${E} ${below100(r)}` : HUNDREDS[h]!;
}

/** Non-negative integer (< 10⁹) → European Portuguese words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => SMALL[Number(d)] ?? d).join(" ");
  if (n < 1000) return below1000(n);
  if (n < 1e6) {
    const th = Math.floor(n / 1000), r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${below1000(th)} ${N.thousand}`;
    if (r === 0) return thousand;
    // "e" before the remainder when it is < 100 or a round hundred (mil e duzentos, mil e vinte)
    return r < 100 || r % 100 === 0 ? `${thousand} ${E} ${below1000(r)}` : `${thousand} ${below1000(r)}`;
  }
  const m = Math.floor(n / 1e6), r = n % 1e6;
  const million = m === 1 ? `${SMALL[1]} ${N.million}` : `${below1000(m)} ${N.millionPlural}`;
  if (r === 0) return million;
  // "e" before a remainder that is < 100 or "round" (milhão e um, milhão e cem, milhão e quinhentos mil)
  return r < 100 || r % 100 === 0 ? `${million} ${E} ${numberToWords(r)}` : `${million} ${numberToWords(r)}`;
}
