/**
 * Arabic number → Chinese numeral characters (quantity reading). The result is spliced back into the Han
 * character stream and phonemized like any other characters, so it inherits segmentation, polyphone
 * disambiguation, and tone sandhi for free (e.g. 一百 → yì bǎi via the phrase dict). Covers integers up to
 * 10¹⁶ and simple decimals (整数 + 点 + digit-by-digit). 2 is read 二 throughout (二千 is understood; the
 * colloquial 两 alternation is a future refinement). Year/phone/ID digit-string readings are out of scope —
 * this is the default quantity reading.
 */

const DIG = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const POS = ["千", "百", "十", ""];  // position value within a 4-digit group
const BIG = ["", "万", "亿", "兆"];   // 10⁴ⁿ group multipliers

/**
 * 0 ≤ n ≤ 9999 → characters, with a single internal 零 for zero gaps. `top` marks the highest group so 2 as a
 * leading multiplier of 百 reads 两 (两百五十) but a non-leading 二百 stays 二 (两千二百). 2 before 千 is always
 * 两; 2 in tens/units stays 二 (二十, 十二).
 */
function group4(n: number, top: boolean): string {
  let s = "";
  let zeroPending = false;
  const digits = [Math.floor(n / 1000) % 10, Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  for (let i = 0; i < 4; i++) {
    const d = digits[i]!;
    if (d === 0) { if (s !== "") zeroPending = true; continue; }
    if (zeroPending) { s += "零"; zeroPending = false; }
    let dig = DIG[d]!;
    if (d === 2 && i === 0) dig = "两";                       // 千 → always 两千
    else if (d === 2 && i === 1 && s === "" && top) dig = "两"; // 百 → 两百 only when leading
    s += dig + POS[i]!;
  }
  return s;
}

/** Non-negative integer → Chinese numeral characters (quantity reading; colloquial 两 for standalone 2). */
export function integerToChinese(n: number): string {
  if (n === 0) return "零";
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 10000); x = Math.floor(x / 10000); }
  let s = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    if (s !== "" && g < 1000) s += "零";              // a group < 1000 below a higher group needs a spoken 零
    const gs = g === 2 && BIG[i] ? "两" : group4(g, s === ""); // 2万/2亿 → 两万/两亿
    s += gs + BIG[i]!;
  }
  return s.replace(/^一十/, "十");                     // 12 → 十二 (not 一十二); 十万, 十亿…
}

/** Digit string → per-digit numeral characters (0 → 〇). Used for year / ID readings (2024 → 二〇二四). */
export function digitsToChinese(digits: string): string {
  return [...digits].map((d) => (d === "0" ? "〇" : DIG[Number(d)] ?? d)).join("");
}

/** Arabic number string (integer or decimal) → Chinese numeral characters. */
export function arabicToChinese(num: string): string {
  const dot = num.indexOf(".");
  if (dot < 0) {
    const n = Number(num);
    return Number.isSafeInteger(n) ? integerToChinese(n) : num;
  }
  const n = Number(num.slice(0, dot) || "0");
  if (!Number.isSafeInteger(n)) return num;
  const frac = [...num.slice(dot + 1)].map((d) => DIG[Number(d)] ?? d).join("");
  return integerToChinese(n) + "点" + frac;   // 3.14 → 三点一四
}
