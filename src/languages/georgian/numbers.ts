/**
 * ⚠ Georgian (ka) VIGESIMAL cardinal number compositor. Returns composed Georgian TEXT that georgian.ts runs
 * through the g2p, so the IPA stays consistent with the word engine. Pattern B is mandatory here: Georgian is
 * NOT decimal-Western below 100, so the shared `westernNumberWords` (units + teens + round TENS) has no round
 * tens to read — there are none. Georgian counts 20–99 in SCORES of twenty.
 *
 *   ⚠ THE SCORE CONSTRUCTION (20–99). The four score words are 20 ოცი, 40 ორმოცი (ორ- "2" × ოც- "20"),
 *     60 სამოცი (3×20), 80 ოთხმოცი (4×20). An exact multiple of 20 is just that word. Anything else is the
 *     score's stem + -და- ("and") + the PLAIN 1–19 numeral, written as ONE word — so the whole 1–19 series
 *     (including the teens) attaches into the same slot:
 *         30 = 20+10 ოცდაათი        45 = 2×20+5  ორმოცდახუთი      67 = 3×20+7  სამოცდაშვიდი
 *         89 = 4×20+9 ოთხმოცდაცხრა  99 = 4×20+19 ოთხმოცდაცხრამეტი
 *     Note there is no "ten" digit at all: 50 is ორმოცდაათი (2×20 + 10), 70 is სამოცდაათი (3×20 + 10),
 *     90 is ოთხმოცდაათი (4×20 + 10). The score index is floor(n/20) and the attached remainder is n − 20·index,
 *     which lands in 0–19 by construction.
 *
 *   ⚠ TRUNCATION (≥ 100). From 100 up, groups are written as SEPARATE words and a numeral that is followed by a
 *     smaller number drops its final ⟨ი⟩ (ასი→ას, ორასი→ორას, ათასი→ათას, მილიონი→მილიონ). This is LOCAL: the
 *     hundred truncates iff its own sub-hundred remainder is non-zero, and a magnitude noun truncates iff any
 *     remainder follows it. So 1300 = ათას სამასი (the thousand truncates, the hundred does not — it is final),
 *     while 1959 = ათას ცხრაას ორმოცდაცხრამეტი (both truncate). A multiplier does NOT truncate: 2001 is
 *     ორი ათას ერთი, not *ორ ათას ერთი.
 *
 * The two shapes are stored as bare/comb pairs in georgian.jsonc, which also carries the source citations
 * (ka.wikipedia "N (რიცხვი)" number articles + year articles for the compounds; Wikipedia "Georgian numerals"
 * for the two rule statements).
 *
 * Judgment call: 1000 is read as the bare ათასი (no *ერთი ათასი — Georgian treats it as a numeral, and every
 * ka.wikipedia year in the 1000s spells it that way), but 10^6 / 10^9 KEEP the numeral — ერთი მილიონი /
 * ერთი მილიარდი, both attested in running ka.wikipedia text (მილიონი/მილიარდი are borrowed nouns).
 */

import { MANIFEST, type GeorgianNumeralPair } from "./manifest.ts";

const N = MANIFEST.numbers;
const { units: UNITS, teens: TEENS, scores: SCORES, hundreds: HUNDREDS } = N;
const MAG = N.magnitudes;

/** 0–19 → the plain Georgian numeral (the series that attaches after -და- in a score compound). */
function sub20(n: number): string {
    return n < 10 ? UNITS[n]! : TEENS[n - 10]!;
}

/** 0–99 → ONE Georgian word. 20–99 is score·20 + remainder, joined by the score stem's -და-. */
function sub100(n: number): string {
    if (n < 20) return sub20(n);
    const s = Math.floor(n / 20), // 1–4 → ოც / ორმოც / სამოც / ოთხმოც
        r = n - s * 20; // 0–19
    return r === 0 ? SCORES.bare[s]! : SCORES.comb[s]! + sub20(r);
}

/** 0–999 → Georgian text. The round hundred truncates iff a sub-hundred remainder follows it (ას ერთი). */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(n);
    return r === 0 ? HUNDREDS.bare[h]! : `${HUNDREDS.comb[h]} ${sub100(r)}`;
}

/** One magnitude group: the (never-truncated) multiplier + the magnitude noun, itself truncated iff `more`
 *  (something follows this group). `keepOne` = whether a count of exactly 1 keeps the numeral ერთი. */
function magnitude(count: number, forms: GeorgianNumeralPair, more: boolean, keepOne: boolean): string {
    const noun = more ? forms.comb : forms.bare;
    if (count === 1) return keepOne ? `${UNITS[1]} ${noun}` : noun;
    return `${sub1000(count)} ${noun}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the მილიარდი group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => UNITS[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Georgian cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // ნული
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(magnitude(bil, MAG.billion, n > 0, true));
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(magnitude(mil, MAG.million, n > 0, true));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(magnitude(th, MAG.thousand, n > 0, false)); // 1000 → bare ათასი
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
