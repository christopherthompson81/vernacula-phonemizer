/**
 * Portuguese number → words (European convention). Space-separated words with the "e" connector. Covers
 * 0 … <10⁹. Decimals read "vírgula" + digits (handled by the caller).
 */

const SMALL = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove",
];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0 ≤ n < 100 */
function below100(n: number): string {
  if (n < 20) return SMALL[n]!;
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? TENS[t]! : `${TENS[t]} e ${SMALL[u]}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  if (n < 100) return below100(n);
  if (n === 100) return "cem";
  const h = Math.floor(n / 100), r = n % 100;
  return r ? `${HUNDREDS[h]} e ${below100(r)}` : HUNDREDS[h]!;
}

/** Non-negative integer (< 10⁹) → European Portuguese words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => SMALL[Number(d)] ?? d).join(" ");
  if (n < 1000) return below1000(n);
  if (n < 1e6) {
    const th = Math.floor(n / 1000), r = n % 1000;
    const thousand = th === 1 ? "mil" : `${below1000(th)} mil`;
    if (r === 0) return thousand;
    // "e" before the remainder when it is < 100 or a round hundred (mil e duzentos, mil e vinte)
    return r < 100 || r % 100 === 0 ? `${thousand} e ${below1000(r)}` : `${thousand} ${below1000(r)}`;
  }
  const m = Math.floor(n / 1e6), r = n % 1e6;
  const million = m === 1 ? "um milhão" : `${below1000(m)} milhões`;
  if (r === 0) return million;
  // "e" before a remainder that is < 100 or "round" (milhão e um, milhão e cem, milhão e quinhentos mil)
  return r < 100 || r % 100 === 0 ? `${million} e ${numberToWords(r)}` : `${million} ${numberToWords(r)}`;
}
