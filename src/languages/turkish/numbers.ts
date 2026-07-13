/**
 * Turkish cardinal number → words (space-separated). Turkish scales by thousands: on/yüz/bin/milyon/…
 * "bir" is dropped before yüz and bin (100 → yüz, 1000 → bin) but kept before milyon+ (bir milyon).
 * 1985 → bin dokuz yüz seksen beş.
 */
const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const SCALES = ["", "bin", "milyon", "milyar", "trilyon", "katrilyon"];

/** 1 ≤ n < 1000 → words. */
function below1000(n: number): string[] {
  const parts: string[] = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h > 0) { if (h > 1) parts.push(ONES[h]!); parts.push("yüz"); } // "yüz", not "bir yüz"
  if (t > 0) parts.push(TENS[t]!);
  if (o > 0) parts.push(ONES[o]!);
  return parts;
}

/** Non-negative integer → Turkish words. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "sıfır";
  const groups: number[] = [];
  let x = Math.floor(n);
  while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const parts: string[] = [];
  for (let g = groups.length - 1; g >= 0; g--) {
    const v = groups[g]!;
    if (v === 0) continue;
    if (g === 1 && v === 1) { parts.push("bin"); continue; } // "bin", not "bir bin"
    parts.push(...below1000(v));
    if (g > 0) parts.push(SCALES[g]!);
  }
  return parts.join(" ");
}
