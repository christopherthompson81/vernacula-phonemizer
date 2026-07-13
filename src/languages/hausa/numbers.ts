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
  if (n < 20) return n === 10 ? [TENS[1]!] : [TENS[1]!, N.teensConnector, ONES[n - 10]!]; // 11–19: goma sha X
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? [TENS[t]!] : [TENS[t]!, N.connector, ONES[u]!];
}
function below1000(n: number): string[] {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h > 0) { parts.push(N.hundred); if (h > 1) parts.push(ONES[h]!); }
  if (r > 0) { if (h > 0) parts.push(N.connector); parts.push(...below100(r)); }
  return parts;
}

/** Non-negative integer → Hausa words. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return ONES[0]!; // sifili
  const parts: string[] = [];
  const thou = Math.floor(n / 1000), rest = n % 1000;
  if (thou > 0) { parts.push(N.thousand); if (thou > 1) parts.push(...below1000(thou)); }
  if (rest > 0) { if (thou > 0) parts.push(N.connector); parts.push(...below1000(rest)); }
  return parts.join(" ");
}
