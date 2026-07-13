/**
 * Korean number → words. Korean has TWO systems: Sino-Korean (일 이 삼 …, used for dates/money/counting above
 * ~100) and native (하나 둘 셋 …, for small counts). This uses the Sino-Korean system (the default for digits),
 * scaling by 만 (10^4) / 억 (10^8) like other CJK. Digits are read as Hangul then phonemized.
 */
const ONES = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const UNITS = ["", "만", "억", "조"]; // 10^0, 10^4, 10^8, 10^12

function below10000(n: number): string {
  let s = "";
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  if (th) s += (th > 1 ? ONES[th] : "") + "천";
  if (h) s += (h > 1 ? ONES[h] : "") + "백";
  if (t) s += (t > 1 ? ONES[t] : "") + "십";
  if (u) s += ONES[u];
  return s;
}

/** Non-negative integer → Sino-Korean Hangul. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return "";
  if (n === 0) return "영";
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
