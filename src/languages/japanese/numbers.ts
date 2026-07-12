/**
 * Japanese number → kana reading (Sino-Japanese counting), handling the common sound changes: 300 さんびゃく,
 * 600 ろっぴゃく, 800 はっぴゃく, 3000 さんぜん, 8000 はっせん, 一 in higher units dropped where idiomatic.
 * Covers 0 … <10¹⁶ (万/億/兆 grouping). The caller feeds the kana through kanaToIpa.
 */
const ONES = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
const HUND = ["", "ひゃく", "にひゃく", "さんびゃく", "よんひゃく", "ごひゃく", "ろっぴゃく", "ななひゃく", "はっぴゃく", "きゅうひゃく"];
const THOU = ["", "せん", "にせん", "さんぜん", "よんせん", "ごせん", "ろくせん", "ななせん", "はっせん", "きゅうせん"];
const UNITS = ["", "まん", "おく", "ちょう", "けい"]; // 10^0, 10^4, 10^8, 10^12, 10^16

/** 1 ≤ n < 10000 → kana. */
function below10000(n: number): string {
  let s = "";
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  s += THOU[th]!;
  s += HUND[h]!;
  if (t === 1) s += "じゅう"; else if (t >= 2) s += ONES[t]! + "じゅう";
  s += ONES[u]!;
  return s;
}

/** Non-negative integer → kana (万/億/兆 groups). 0 → れい; too large → digit-by-digit. */
export function numberToKana(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return [...String(Math.abs(n))].map((d) => ONES[Number(d)] || "れい").join("");
  if (n === 0) return "れい";
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
