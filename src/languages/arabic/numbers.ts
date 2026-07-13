/**
 * Arabic number → canonical IPA (Modern Standard Arabic, counting/masculine forms). Emitted as IPA directly
 * (not spelled Arabic) because the g2p needs diacritics that a bare numeral spelling lacks. Structure: ones
 * precede tens joined by wa (٢١ → waːħid wa ʕiʃruːn); hundreds/thousands use construct + dual forms. Covers
 * 0 … <10⁹; gender agreement and rarer construct nuances are deferred. See the shim for the target forms.
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in arabic.jsonc; the composition logic below is the algorithm.
const { ones: ONES, teens: TEENS, tens: TENS, hundredsConstruct: HUNDREDS_CONSTRUCT, connector: WA, magnitudes: MAG } = MANIFEST.numbers;

/** 0 ≤ n < 100 */
function below100(n: number): string {
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? TENS[t]! : `${ONES[u]} ${WA} ${TENS[t]}`;   // ones precede tens: 21 = waːħid wa ʕiʃruːn
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  let head = "";
  if (h === 1) head = MAG.hundred;
  else if (h === 2) head = MAG.hundredDual;
  else if (h >= 3) head = `${HUNDREDS_CONSTRUCT[h]}${MAG.hundred}`;   // θalaːθumiʔa
  if (h === 0) return below100(n);
  return r ? `${head} ${WA} ${below100(r)}` : head;
}

/** 1 ≤ n < 10⁶ */
function below1e6(n: number): string {
  if (n < 1000) return below1000(n);
  const th = Math.floor(n / 1000), r = n % 1000;
  let head: string;
  if (th === 1) head = MAG.thousand;
  else if (th === 2) head = MAG.thousandDual;
  else if (th <= 10) head = `${below100(th)} ${MAG.thousandsPlural}`;   // 3–10 thousand: plural ʔaːlaːf
  else head = `${below1000(th)} ${MAG.thousand}`;
  return r ? `${head} ${WA} ${below1000(r)}` : head;
}

/** Non-negative integer (< 10⁹) → Arabic IPA words. Larger / invalid → digit-by-digit (digits only). */
export function numberToIpa(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
    return [...String(Math.abs(n))].map((d) => ONES[Number(d)]).filter(Boolean).join(" ");
  }
  if (n === 0) return ONES[0]!; // sˤifr
  if (n < 1e6) return below1e6(n);
  const m = Math.floor(n / 1e6), r = n % 1e6;
  let head: string;
  if (m === 1) head = MAG.million;
  else if (m === 2) head = MAG.millionDual;                    // dual
  else if (m <= 10) head = `${below100(m)} ${MAG.millionsPlural}`;   // 3–10 million: plural malaːjiːn
  else head = `${below1000(m)} ${MAG.million}`;
  return r ? `${head} ${WA} ${below1e6(r)}` : head;
}
