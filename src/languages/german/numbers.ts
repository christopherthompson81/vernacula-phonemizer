/**
 * German number → words (cardinals). German writes numbers as single compound words with units before tens
 * (einundzwanzig). Output is space-separated at the thousand/million boundaries so each chunk reads through the
 * g2p; within a chunk it stays compounded. Covers 0 … <10⁹.
 */
const ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
  "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

/** 1 ≤ n < 100 (compounded: einundzwanzig). */
function below100(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10), u = n % 10;
  if (u === 0) return TENS[t]!;
  const unit = u === 1 ? "ein" : ONES[u]!;   // "ein" in compounds (einundzwanzig)
  return `${unit}und${TENS[t]}`;
}

/** 1 ≤ n < 1000 (compounded: einhundertdreiundzwanzig). */
function below1000(n: number): string {
  if (n < 100) return below100(n);
  const h = Math.floor(n / 100), r = n % 100;
  const hundred = `${h === 1 ? "ein" : ONES[h]}hundert`;
  return r ? `${hundred}${below100(r)}` : hundred;
}

/** Non-negative integer (< 10⁹) → German words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
  if (n === 0) return "null";
  if (n < 1000) return below1000(n);
  const parts: string[] = [];
  const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
  if (mil) parts.push(mil === 1 ? "eine Million" : `${below1000(mil)} Millionen`);
  if (th) parts.push(`${th === 1 ? "ein" : below1000(th)}tausend`);
  if (r) parts.push(below1000(r));
  return parts.join(" ");
}
