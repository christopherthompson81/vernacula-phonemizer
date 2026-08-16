/**
 * Belarusian Roman-numeral reading. A century is read as an ORDINAL: `XIX стагоддзе` is *дзевятнаццатае
 * стагоддзе*; the shared cardinal pass gives *дзевятнаццаць стагоддзе*, which means "nineteen centuries".
 * `roman` is **79,181** instances corpus-wide in `tools/corpus/mined/be.jsonc`, and the retained text's own
 * `XIX ст.` was reading as the cardinal.
 *
 * FORM: **neuter** nominative singular, because the Belarusian century noun is neuter (стагоддзе) — the same
 * choice Ukrainian makes for століття and the opposite of Russian's masculine век. So this table is *-ае*,
 * not *-ы*: дзевятнаццатае, дваццатае, саракавое.
 *
 * SOURCE. The spelled phrase is attested on be.wikipedia as a phrase: `дваццатае стагоддзе` ×15 in 14
 * articles, `дзевятнаццатае стагоддзе` ×5 in 5 — mostly as titles ("«Дваццатае стагоддзе» (італ.:
 * Novecento)") but also in running prose ("Дзевятнаццатае стагоддзе. Джонатан Харкер — малады агент…").
 * The unit table's own words come from the masculine ordinals sourced in `normalize.ts`, whose per-word
 * attestation counts are recorded there; only the ending differs.
 *
 * DOCUMENTED LIMITATIONS, the same ones Ukrainian records (one word per integer, no access to the matched
 * context word):
 *  - CASE. "у XIX стагоддзі" wants the locative *дзевятнаццатым*. The nominative is emitted; oblique context
 *    forms are still matched, since the right lexeme with the wrong ending beats the wrong lexeme.
 *  - GENDER. The table is neuter, so `век` is deliberately EXCLUDED from the context regex — `XX век` keeps
 *    the cardinal rather than acquiring a wrong-gender *дваццатае век*. Belarusian standardly says
 *    стагоддзе for a century anyway.
 *  - REGNAL context is NOT triggered (it needs a proper-name list, and a masculine regnal name wants *-ы*).
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { RomanPolicy } from "../../core/roman.ts";

/** Cardinal tens, read from the language's own number data (belarusian.jsonc): дваццаць, трыццаць, сорак, … */
const TENS_CARDINAL = loadManifest<{ numbers: { tens: Record<string, string> } }>(
    import.meta.url,
    "belarusian.jsonc",
).numbers.tens;

/** 1–19, NEUTER nominative. */
const ORD_1_19: readonly string[] = [
    "", "першае", "другое", "трэцяе", "чацвёртае", "пятае", "шостае", "сёмае", "восьмае", "дзявятае",
    "дзясятае", "адзінаццатае", "дванаццатае", "трынаццатае", "чатырнаццатае", "пятнаццатае",
    "шаснаццатае", "сямнаццатае", "васямнаццатае", "дзевятнаццатае",
];

/** Whole tens, NEUTER nominative — own stems (саракавое, дзевяностае). */
const ORD_TENS: readonly string[] = [
    "", "дзясятае", "дваццатае", "трыццатае", "саракавое", "пяцідзясятае", "шасцідзясятае",
    "сямідзясятае", "васьмідзясятае", "дзевяностае",
];

/**
 * Integer → the Belarusian ordinal, neuter nominative. Like Russian and Ukrainian (and unlike Polish) only
 * the LAST element inflects above 20: 21 → *дваццаць першае*. `undefined` above 100 falls back to the
 * cardinal, which is also the right reading for a Roman-numeral year.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return "сотае";
    if (n < 20) return ORD_1_19[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (u === 0) return ORD_TENS[t];
    const tens = TENS_CARDINAL[String(t * 10)];
    return tens === undefined ? undefined : `${tens} ${ORD_1_19[u]}`;
}

/**
 * стагоддзе in the cases that occur, AND the bare abbreviation `ст.` / `стст.`
 *
 * ⚠ THE ABBREVIATION IS NOT OPTIONAL, and getting that wrong is an ordering mistake worth naming: this pass
 * runs at the REGISTRY seam, wrapping `engine.text()`, so it sees the raw input — `XIX ст.` — and NOT the
 * `стагоддзя` that `normalize.ts` step 4 will later expand it to. Written for the expanded form alone, the
 * policy silently never fired on the abbreviation, which is the form the corpus actually writes.
 * `гадавіна` (anniversary) and `з’езд` are the other ordinal contexts that reach past XXX. `век` is
 * excluded on purpose — see the header note on gender.
 */
const CONTEXT = /^(ст|стст|стагодд(зе|зя|зю|зі|зем|зяў|зях|зямі)|гадавін(а|ы|е|у|ай)|з[’'`]езд(а|у|ам|ы|аў)?)$/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
