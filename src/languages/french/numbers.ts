/**
 * French number → words (standard/France, vigesimal 70/80/90). Output is space-separated words (no hyphens)
 * so each reads through the g2p. Covers 0 … <10⁹. Decimals read "virgule" + digits.
 */

const SMALL = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix sept", "dix huit", "dix neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante"]; // 20–50 (60+ are vigesimal)

/** 0 ≤ n < 100 */
function below100(n: number): string {
  if (n < 20) return SMALL[n]!;
  if (n < 60) {
    const t = Math.floor(n / 10), u = n % 10;
    if (u === 0) return TENS[t]!;
    if (u === 1) return `${TENS[t]} et un`;
    return `${TENS[t]} ${SMALL[u]}`;
  }
  if (n < 80) {                                   // 60–79: soixante + 0..19
    const r = n - 60;
    if (r === 0) return "soixante";
    if (r === 1) return "soixante et un";
    if (r === 11) return "soixante et onze";
    return `soixante ${SMALL[r]}`;
  }
  const r = n - 80;                               // 80–99: quatre-vingt(s) + 0..19
  return r === 0 ? "quatre vingts" : `quatre vingt ${SMALL[r]}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100), r = n % 100;
  const hundred = h === 1 ? "cent" : `${SMALL[h]} cent${r === 0 ? "s" : ""}`; // deux cents, deux cent un
  return r ? `${hundred} ${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → French words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => SMALL[Number(d)] ?? d).join(" ");
  if (n === 0) return "zéro";
  if (n < 1000) return below1000(n);
  if (n < 1e6) {
    const th = Math.floor(n / 1000), r = n % 1000;
    const thousand = th === 1 ? "mille" : `${below1000(th)} mille`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
  }
  const m = Math.floor(n / 1e6), r = n % 1e6;
  const million = m === 1 ? "un million" : `${below1000(m)} millions`;
  return r ? `${million} ${numberToWords(r)}` : million;
}
