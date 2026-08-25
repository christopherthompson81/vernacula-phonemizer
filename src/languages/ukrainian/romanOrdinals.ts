/**
 * Ukrainian Roman-numeral reading. A century is read as an ORDINAL: `XIX століття` is *дев'ятнадцяте
 * століття*; the cardinal (*дев'ятнадцять століття*) would mean "nineteen centuries". Sources: Ukrainian
 * orthography (centuries written in Roman numerals, read as ordinal adjectives); the spelled form
 * "дев'ятнадцяте століття" is attested in running Ukrainian text (history teaching material, reference sites).
 *
 * FORM: **neuter** nominative singular — the Ukrainian century noun is neuter (століття, сторіччя), not
 * masculine as in Russian and Polish. So this table is *-е*, not *-ий*: дев'ятнадцяте, двадцяте, сорокове.
 * This is the one place in this group where the agreement form differs, and it follows directly from which
 * noun the language actually uses for "century".
 *
 * DOCUMENTED LIMITATIONS (one word per integer, no access to the matched context word):
 *  - CASE. "у XIX столітті" wants the locative *дев'ятнадцятому*. The nominative is emitted; oblique context
 *    forms are still matched, since the right lexeme with the wrong ending beats the wrong lexeme.
 *  - GENDER. Because the table is neuter, a masculine context reads wrong — which is why **вік / віку** is
 *    deliberately EXCLUDED from the context regex: `XX вік` stays a cardinal rather than producing the neuter
 *    *двадцяте вік*. Ukrainian standardly uses століття for a century anyway (вік more often means
 *    age/lifetime), so the excluded case is both rarer and the one the table cannot serve.
 *  - REGNAL context is NOT triggered (needs a proper-name list; and a masculine regnal name would want *-ий*).
 */
import { MANIFEST as DEF } from "./manifest.ts";
import type { RomanPolicy } from "../../core/roman.ts";

/** Cardinal tens, read from the language's own number data (ukrainian.jsonc): двадцять, тридцять, сорок, … */
const TENS_CARDINAL = DEF.numbers.tens;
/** The NEUTER ordinal tables (ukrainian.jsonc `romanOrdinals`) — see the header on why they are not the
 *  masculine ones normalize.ts uses. Apostrophe is U+0027, matching the orthography used throughout the
 *  manifest (дев'ять, п'ять). */
const ORD = DEF.romanOrdinals;

/**
 * Integer → Ukrainian ordinal, neuter nominative. Like Russian (and unlike Polish) only the LAST element
 * inflects above 20: 21 → *двадцять перше*. `undefined` above 100 falls back to the cardinal.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return ORD.hundredth;
    if (n < 20) return ORD.oneToNineteen[n];
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return ORD.tens[t];
    const tens = TENS_CARDINAL[String(t * 10)];
    return tens === undefined ? undefined : `${tens} ${ORD.oneToNineteen[u]}`;
}

/**
 * The nouns a Roman numeral is read as an ordinal next to (ukrainian.jsonc `romanOrdinals.context`) —
 * століття / сторіччя in the cases that occur, plus річниця ("L річниця") and з'їзд. вік is excluded on
 * purpose; see the header note on gender, and the jsonc, where the exclusion is visible as an absence.
 */
const CONTEXT = new RegExp(`^(?:${ORD.context.join("|")})$`, "iu");

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
