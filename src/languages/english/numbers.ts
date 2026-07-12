/**
 * English number → spoken words (short scale). Clean reimplementation: digit input becomes the same WORDS
 * a person would type, which then resolve through the lexicon like any other word — so 42 == "forty two"
 * with no fragment-table indirection. Covers 0 … nonillion (bigint). Cardinal + ordinal.
 */

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const GROUPS: ReadonlyArray<{ value: bigint; name: string }> = [
  { value: 10n ** 30n, name: "nonillion" }, { value: 10n ** 27n, name: "octillion" },
  { value: 10n ** 24n, name: "septillion" }, { value: 10n ** 21n, name: "sextillion" },
  { value: 10n ** 18n, name: "quintillion" }, { value: 10n ** 15n, name: "quadrillion" },
  { value: 10n ** 12n, name: "trillion" }, { value: 10n ** 9n, name: "billion" },
  { value: 10n ** 6n, name: "million" }, { value: 1000n, name: "thousand" },
];
const MAX = 10n ** 33n - 1n;

/** cardinal words for 0 ≤ n < 1000. */
function below1000(n: number): string[] {
  const out: string[] = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)]!, "hundred"); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]!); if (n % 10) out.push(ONES[n % 10]!); }
  else if (n > 0) out.push(ONES[n]!);
  return out;
}

/** Cardinal number → words. `1234` → ["one","thousand","two","hundred","thirty","four"]. */
export function numberToWords(n: bigint): string[] {
  if (n < 0n || n > MAX) return [String(n)];
  if (n === 0n) return ["zero"];
  const out: string[] = [];
  for (const g of GROUPS) {
    if (n >= g.value) { out.push(...below1000(Number(n / g.value)), g.name); n %= g.value; }
  }
  if (n > 0n) out.push(...below1000(Number(n)));
  return out;
}

/** Cardinal word → ordinal word (English marks only the LAST word: 21 → "twenty first"). */
const ORDINAL: Record<string, string> = {
  zero: "zeroth", one: "first", two: "second", three: "third", four: "fourth", five: "fifth",
  six: "sixth", seven: "seventh", eight: "eighth", nine: "ninth", ten: "tenth", eleven: "eleventh",
  twelve: "twelfth", thirteen: "thirteenth", fourteen: "fourteenth", fifteen: "fifteenth",
  sixteen: "sixteenth", seventeen: "seventeenth", eighteen: "eighteenth", nineteen: "nineteenth",
  twenty: "twentieth", thirty: "thirtieth", forty: "fortieth", fifty: "fiftieth", sixty: "sixtieth",
  seventy: "seventieth", eighty: "eightieth", ninety: "ninetieth", hundred: "hundredth",
  thousand: "thousandth", million: "millionth", billion: "billionth", trillion: "trillionth",
  quadrillion: "quadrillionth", quintillion: "quintillionth", sextillion: "sextillionth",
  septillion: "septillionth", octillion: "octillionth", nonillion: "nonillionth",
};

/** Ordinal number → words. `21` → ["twenty","first"]. */
export function ordinalToWords(n: bigint): string[] {
  const words = numberToWords(n);
  const last = words[words.length - 1];
  if (last !== undefined && ORDINAL[last] !== undefined) words[words.length - 1] = ORDINAL[last]!;
  return words;
}
