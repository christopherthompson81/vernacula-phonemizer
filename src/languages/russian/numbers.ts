/**
 * Russian number → words (cardinals, nominative). Space-separated words that each read through the stress
 * dictionary + g2p. Covers 0 … <10⁹. Gender/case agreement is simplified to the nominative base forms.
 */
const ONES = [
  "ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять",
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать",
  "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

/** Plural form selector for Russian quantities (1 → one, 2–4 → few, else → many). */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** 1 ≤ n < 1000 */
function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  if (h) parts.push(HUNDREDS[h]!);
  if (t >= 2) { parts.push(TENS[t]!); if (u) parts.push(ONES[u]!); }
  else if (t === 1) parts.push(ONES[10 + u]!);
  else if (u) parts.push(ONES[u]!);
  return parts.join(" ");
}

/** Non-negative integer (< 10⁹) → Russian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return [...String(Math.abs(n))].map((d) => ONES[Number(d)] ?? d).join(" ");
  if (n < 20) return ONES[n]!;
  if (n < 1000) return below1000(n);
  const parts: string[] = [];
  const mil = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), r = n % 1000;
  if (mil) parts.push(below1000(mil), plural(mil, "миллион", "миллиона", "миллионов"));
  if (th) {
    // тысяча is feminine → 1 → одна, 2 → две
    const thWords = below1000(th).replace(/один$/, "одна").replace(/два$/, "две"); // тысяча is feminine (JS \b fails on Cyrillic)
    parts.push(thWords, plural(th, "тысяча", "тысячи", "тысяч"));
  }
  if (r) parts.push(below1000(r));
  return parts.join(" ");
}
