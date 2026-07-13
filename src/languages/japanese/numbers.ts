/**
 * Japanese number → kana reading (Sino-Japanese counting), handling the common sound changes: 300 さんびゃく,
 * 600 ろっぴゃく, 800 はっぴゃく, 3000 さんぜん, 8000 はっせん, 一 in higher units dropped where idiomatic.
 * Covers 0 … <10¹⁶ (万/億/兆 grouping). The caller feeds the kana through kanaToIpa.
 */
import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in japanese.jsonc; the group compositor below is the algorithm.
const N = MANIFEST.numbers;
const ONES = N.ones, HUND = N.hundreds, THOU = N.thousands, UNITS = N.myriadUnits;

/** 1 ≤ n < 10000 → kana. */
function below10000(n: number): string {
  let s = "";
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  s += THOU[th]!;
  s += HUND[h]!;
  if (t === 1) s += N.ten; else if (t >= 2) s += ONES[t]! + N.ten;
  s += ONES[u]!;
  return s;
}

/** Non-negative integer → kana (万/億/兆 groups). 0 → れい; too large → digit-by-digit. */
export function numberToKana(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return [...String(Math.abs(n))].map((d) => ONES[Number(d)] || N.zero).join("");
  if (n === 0) return N.zero;
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
  let out = "";
  for (let g = groups.length - 1; g >= 0; g--) {
    if (groups[g] === 0) continue;
    out += below10000(groups[g]!) + (UNITS[g] ?? "");
  }
  return out;
}
