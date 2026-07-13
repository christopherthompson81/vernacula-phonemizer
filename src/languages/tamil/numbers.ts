/**
 * Tamil cardinal number → words (space-separated). Basic compositor: units, tens, hundreds, then ஆயிரம்
 * (1000) / லட்சம் (10^5) / கோடி (10^7) grouping (Indian system). Ones/tens are lexicalised; this covers the
 * common range and degrades to digit-by-digit for very large numbers.
 */
const ONES = ["பூஜ்ஜியம்", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது"];
const TENS = ["", "பத்து", "இருபது", "முப்பது", "நாற்பது", "ஐம்பது", "அறுபது", "எழுபது", "எண்பது", "தொண்ணூறு"];

function below100(n: number): string[] {
  if (n < 10) return n === 0 ? [] : [ONES[n]!];
  const t = Math.floor(n / 10), u = n % 10;
  return u === 0 ? [TENS[t]!] : [TENS[t]!, ONES[u]!];
}
function below1000(n: number): string[] {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h === 1) parts.push("நூறு");
  else if (h > 1) parts.push(ONES[h]!, "நூறு");
  parts.push(...below100(r));
  return parts;
}

/** Non-negative integer → Tamil words. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return ONES[0]!;
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thou = Math.floor(n / 1000); n %= 1000;
  if (crore > 0) parts.push(...below1000(crore), "கோடி");
  if (lakh > 0) parts.push(...below100(lakh), "லட்சம்");
  if (thou > 0) parts.push(...below1000(thou), "ஆயிரம்");
  parts.push(...below1000(n));
  return parts.join(" ");
}
