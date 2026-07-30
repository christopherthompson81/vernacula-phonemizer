/**
 * Russian Roman-numeral reading. A century is read as an ORDINAL: `XIX век` is *девятнадцатый век*, never
 * *девятнадцать век* (which would mean "nineteen century"). Sources: Русская орфография — centuries and
 * regnal numbers are written in Roman numerals and read as ordinal adjectives; the reading is attested
 * verbatim in running text (e.g. "девятнадцатый век" / "двадцатый век" as book and chapter titles).
 *
 * FORM: masculine nominative singular, because the dominant context noun **век** is masculine — *девятнадцатый
 * век*. Same form serves a regnal name (Пётр I → *Пётр Первый*), so no second table is needed.
 *
 * DOCUMENTED LIMITATIONS (the contract emits ONE word per integer, with no access to the matched context):
 *  - CASE. Russian century phrases are very often oblique — "в XIX веке", "конец XIX века" — which want
 *    *девятнадцатом* / *девятнадцатого*. The nominative is emitted regardless. Oblique contexts are still
 *    matched deliberately: the right lexeme with the wrong ending ("девятнадцатый веке") is far closer to the
 *    intended reading than the cardinal ("девятнадцать веке"), which is the only alternative on offer.
 *  - GENDER. A feminine or neuter context noun (годовщина, столетие → *пятидесятая*, *двадцатое*) reads
 *    masculine. Accepted for the same reason as case; a feminine regnal name (Екатерина II → *Вторая*) would
 *    likewise read *Второй*.
 *  - REGNAL context is NOT triggered. Detecting it needs a proper-name list (the word before the numeral is
 *    the name itself, not a title), and the flagship Russian cases are single letters — `Пётр I`, `Иван IV` —
 *    which the shared pass never converts anyway. Bare numerals stay cardinal, as elsewhere in the fleet.
 */
import type { RomanPolicy } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";

/** Cardinal tens, reused from the language's own number data (russian.jsonc): двадцать, тридцать, … */
const TENS_CARDINAL = MANIFEST.numbers.tens;

/** 1–19 — irregular stems throughout (первый … четвёртый), so a table, not a rule. */
const ORD_1_19: readonly string[] = [
    "", "первый", "второй", "третий", "четвёртый", "пятый", "шестой", "седьмой", "восьмой", "девятый",
    "десятый", "одиннадцатый", "двенадцатый", "тринадцатый", "четырнадцатый", "пятнадцатый",
    "шестнадцатый", "семнадцатый", "восемнадцатый", "девятнадцатый",
];

/** Whole tens — their own stems (сороковой, пятидесятый), not derivable from the cardinal. */
const ORD_TENS: readonly string[] = [
    "", "десятый", "двадцатый", "тридцатый", "сороковой", "пятидесятый", "шестидесятый", "семидесятый",
    "восьмидесятый", "девяностый",
];

/**
 * Integer → Russian ordinal, masculine nominative. Regular above 20: only the LAST element inflects, the tens
 * stay cardinal (21 → *двадцать первый*), which is what distinguishes Russian from Polish here. Returns
 * `undefined` above 100 — Roman numerals in running text do not reach there in an ordinal context, and the
 * caller then falls back to the cardinal.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return "сотый";
    if (n < 20) return ORD_1_19[n];
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? ORD_TENS[t] : `${TENS_CARDINAL[t]} ${ORD_1_19[u]}`;
}

/**
 * Century noun in the cases that actually occur (век / века / веке / веком / веков / веках, столетие and its
 * paradigm), plus the two ordinal-taking count nouns that reach past XXX in real text — годовщина ("L
 * годовщина") and съезд ("XX съезд"), the cases that motivate covering 40/50/60 rather than stopping at
 * XXI. `-у` is included for век (dative and the locative второй в веку).
 */
const CONTEXT = /^(век(а|е|у|ом|ов|ам|ах|ами)?|столети(е|я|и|ю|ем|й|ям|ях|ями)|годовщин(а|ы|е|у|ой|ам|ах)?|съезд(а|е|у|ом|ы|ов|ам|ах)?)$/iu;

/** Russian writes `XIX век` (numeral first) as the norm; `век XIX` occurs in reference lists and datings. */
/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
