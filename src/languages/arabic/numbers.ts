/**
 * Arabic number → canonical IPA (Modern Standard Arabic, counting/masculine forms). Emitted as IPA directly
 * (not spelled Arabic) because the g2p needs diacritics that a bare numeral spelling lacks. Structure: ones
 * precede tens joined by wa (٢١ → waːħid wa ʕiʃruːn); hundreds/thousands use construct + dual forms. Covers
 * 0 … <10⁹; gender agreement and rarer construct nuances are deferred. See the shim for the target forms.
 */

const ONES = ["sˤifr", "waːħid", "iθnaːn", "θalaːθa", "ʔarbaʕa", "xamsa", "sitta", "sabʕa", "θamaːnija", "tisʕa"];
const TEENS = ["ʕaʃara", "ʔaħada ʕaʃar", "iθnaː ʕaʃar", "θalaːθata ʕaʃar", "ʔarbaʕata ʕaʃar",
  "xamsata ʕaʃar", "sittata ʕaʃar", "sabʕata ʕaʃar", "θamaːnijata ʕaʃar", "tisʕata ʕaʃar"];
const TENS = ["", "", "ʕiʃruːn", "θalaːθuːn", "ʔarbaʕuːn", "xamsuːn", "sittuːn", "sabʕuːn", "θamaːnuːn", "tisʕuːn"];
// hundreds: 1=miʔa, 2=miʔataːn (dual), 3-9 = ones-construct + miʔa
const HUNDREDS_CONSTRUCT = ["", "", "", "θalaːθu", "ʔarbaʕu", "xamsu", "sittu", "sabʕu", "θamaːnu", "tisʕu"];

/** 0 ≤ n < 100 */
function below100(n: number): string {
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? TENS[t]! : `${ONES[u]} wa ${TENS[t]}`;   // ones precede tens: 21 = waːħid wa ʕiʃruːn
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  let head = "";
  if (h === 1) head = "miʔa";
  else if (h === 2) head = "miʔataːn";
  else if (h >= 3) head = `${HUNDREDS_CONSTRUCT[h]}miʔa`;      // θalaːθumiʔa
  if (h === 0) return below100(n);
  return r ? `${head} wa ${below100(r)}` : head;
}

/** 1 ≤ n < 10⁶ */
function below1e6(n: number): string {
  if (n < 1000) return below1000(n);
  const th = Math.floor(n / 1000), r = n % 1000;
  let head: string;
  if (th === 1) head = "ʔalf";
  else if (th === 2) head = "ʔalfaːn";
  else if (th <= 10) head = `${below100(th)} ʔaːlaːf`;         // 3–10 thousand: plural ʔaːlaːf
  else head = `${below1000(th)} ʔalf`;
  return r ? `${head} wa ${below1000(r)}` : head;
}

/** Non-negative integer (< 10⁹) → Arabic IPA words. Larger / invalid → digit-by-digit. */
export function numberToIpa(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => ONES[Number(d)]!).join(" ");
  if (n === 0) return "sˤifr";
  if (n < 1e6) return below1e6(n);
  const m = Math.floor(n / 1e6), r = n % 1e6;
  const head = m === 1 ? "miljuːn" : `${below1000(m)} miljuːn`;
  return r ? `${head} wa ${below1e6(r)}` : head;
}
