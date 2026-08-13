/**
 * Igbo text normalization — the symbols a reader voices, rewritten to words before the tokenizer sees them.
 *
 * ⚠ Igbo has no independent referee (wikipron, epitran and kaikki all 404), so readings here rest on corpus
 * evidence and dictionary lookup rather than on a transcription source.
 *
 * Deliberately absent, because no usable word was found and inventing one is worse than silence: DEGREES
 * (neither `dịgrii` nor `selsiọs` occurs at all), MULTIPLICATION (the candidate `mụba` is the verb "to
 * increase", not the operator), and `£` / `€` (the signs occur but the words are ambiguous with the weight
 * unit, or too thin).
 *
 * ── UNITS, and the one key that is refused ─────────────────────────────────────────────────────────────
 *
 * This layer shipped with NO `units` table at all — not a table with a hole in it — so every metric
 * abbreviation reached the phoneme sink verbatim: `10 km` → *iɾi km*, and `48 kg` → *iɾi anɔ na asatɔ kɡ*,
 * the worst of them, where the letters are not merely left alone but PRONOUNCED as a cluster.
 *
 * Four keys are declared, from the five words below. Each word is a token on ig.wikipedia with the
 * measurement sense read in its own examples, and four of the five also occur in the mined artifact:
 *
 *   km  kilomita   99 hits / 20 articles · artifact ×9   — *"kilomita 70 ruo 80 n'ogologo"* (a length)
 *   mm  milimita   47 / 20              · artifact ×1   — see the false friend below
 *   cm  sentimita  97 / 20              · artifact ×1   — *"nkata dị sentimita 18 na dayameta"*
 *   kg  kilogram   85 / 20              · artifact ×1   — *"ihe omume ụmụ nwoke 55 kilogram"*
 *
 * ⚠ `milimita`'S HIT COUNT IS A TRAP, and reading the examples is what caught it: the densest wiki passage
 * is a banknote list — *"5 milimita 10 milimita 20 milimita … dinar 1 dinar Dinar 2"* — which is the Tunisian
 * *millime*, a CURRENCY SUBUNIT, not the millimetre. The same shape as `bar`'s `Komma` (all verb) and `ht`'s
 * `pwen` (all sports points). What rescues `mm` is that the artifact GLOSSES ITS OWN ABBREVIATION in the
 * measurement frame: *"mmiri ozuzo kwa afọ nke 580 milimita (22.8 in)"*, and all NINE of the artifact's
 * after-a-digit `mm` instances are rainfall (*"ihe dika 1,287 mm nime otu afǫ"*). The sense is settled by the
 * corpus, not by the count.
 *
 * ⚠ `m` IS REFUSED THOUGH IT HAS THE HIGHEST EXPOSURE OF ANY ABBREVIATION (14 after a digit, against `mm`'s
 * 9 and `km`'s 7). Of those 14: two are genuine elevations, eleven are athletics event names calqued from
 * English (`4 × 200 m freestyle relay`), and ONE IS NOT A METRE — *"a $60 m big-screen adaptation"*, where
 * `m` is *million*. A rule that replaces text cannot be 1-in-14 confidently wrong. And Igbo makes the
 * one-letter-key trap sharper than the tier's own `Il-76s` example does: `m` is the Igbo FIRST-PERSON
 * SINGULAR PRONOUN, the commonest bound morpheme in the language. It stays unauthored, and 14 occurrences
 * stay unread — silently, since a stray `m` voices as `m`, unlike `kg`.
 *
 * The same reading of the exposure table refuses the rest. `ha` is 0 after a digit and 54 as a bare token,
 * because `ha` is *"they"*; `in` (1 / 30) and `s` (0 / 19) are the same story — for a short key the
 * bare-token column measures the LANGUAGE, not the unit. `ft` (4), `mi` (3) and `in` (1) are imperial and
 * appear ONLY as a parenthetical gloss of a metric figure the sentence already gave (*"kilomita 115 (71
 * mi)"*), so reading them would say one measurement twice. No `unitPer`: there is no `km/h` in the artifact
 * at all and `h` is 0 after a digit, so a rate would need two more words sourced to serve nothing.
 *
 * ── SQUARED, and the word the obvious candidate was hiding ─────────────────────────────────────────────
 *
 * `km2` is 4 after a digit here (*"ngụkọta ala nke 923,768 km2 (356,669 sq mi)"*, *"mpaghara ala 198 km2"*),
 * always ASCII — the artifact contains no `km²` at all. Declaring `km` WITHOUT a measure word makes that
 * WORSE rather than better: the tier's documented fallback re-emits the exponent, and an ascii `2` is not a
 * visible leak the way `²` is — it is a NUMBER, so *790 km2* read *"naɾɪ asaa na iɾi itoolu kilomita abʊɔ"*,
 * "790 kilometres two". A wrong quantity, invented by this layer, where before there was only raw text.
 *
 * ⚠ THE FIRST CANDIDATE WAS THE WRONG WORD AND ITS COUNT SAID OTHERWISE. Both the artifact and the wiki
 * write *"square kilomita 469"*, and `square` attests ×154 / 20 articles — but the examples are `P-Square`
 * (a Nigerian duo), `Cabot Square` (a plaza), `Square Records`. English proper nouns, not a measure word.
 * The real one is `skwea`, ×44 / 19 articles, and every single example is this exact slot:
 *
 *   *"kilomita skwea 7,223 (maịl skwea 2,789)"* · *"kilomita skwea 900"* · *"kilomita skwea 49,800"*
 *
 * NOUN, then modifier, then number — so `position: "after"`, which `unitPrefix` then completes into the
 * attested three-part shape without any further arrangement. `cubed` stays undeclared: no `km³` anywhere in
 * the artifact and no candidate word found, so the fallback keeps the unit's reading and leaves the mark.
 *
 * `cm` is the one key with ZERO artifact exposure, declared on the word's own evidence rather than the
 * abbreviation's — said here rather than hidden.
 *
 * ⚠ All five words are UNDOTTED. `kilomịta` has zero attestations; only `mịta` exists as a thin minority
 * spelling (18 / 3). Shipped untoned like every other word this layer emits.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

/**
 * THE UNIT TABLE, with the gloss each word was sourced by. See the UNIT section of the header for every
 * attestation, its sense, the `milimita`/*millime* false friend, and why `m` is refused.
 */
const UNIT = {
    km: "kilomita", // *"kilomita 70 ruo 80 n'ogologo"* — a length
    mm: "milimita", // *"mmiri ozuzo kwa afọ nke 580 milimita (22.8 in)"* — rainfall, the artifact's own gloss
    cm: "sentimita", // *"nkata dị sentimita 18 na dayameta"* — a diameter
    kg: "kilogram", // *"ihe omume ụmụ nwoke 55 kilogram"* — a weight class
} as const;

const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⚠ THE SIGN FOLLOWS THE NUMBER BUT THE WORD PRECEDES IT — the one thing here that assuming English order
     * gets wrong. Written Igbo puts the sign after (`9%`); spoken Igbo puts the word first (`pasent 60`). Same
     * shape as Turkish `yüzde 40`.
     */
    percent: ["pasent"],
    percentPrefix: true,
    /** The word FOLLOWS the number here (`nde naira`, "million naira"), which is the tier's default. */
    currency: { "₦": ["naira"], $: ["dollar"] },
    /** Derived from the ONE table above, so the tier and rule 2b can never disagree about which keys exist. */
    units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])),
    /**
     * ⚠ THE UNIT NOUN PRECEDES ITS NUMBER — the second place in this file where assuming English order is
     * wrong, and for the same reason as `percentPrefix`: Igbo writes the abbreviation after the digits and
     * SAYS the noun first, because an Igbo numeral follows the noun it counts (*ụlọ atọ*, "house three").
     *
     * Established from the spelled-out instances, which are the ones that show what a reader says — a writer
     * spelling the phrase out in words is no longer copying a numeric layout. On ig.wikipedia `kilomita`
     * (the one term with no substring contamination, since `mita` sits inside the other three) precedes a
     * spelled numeral 330 times and follows one 61 — 84% noun-first — and precedes DIGITS 773 against 284.
     * The artifact's own spelled cases agree: *"kilomita otu narị na iri isii na ise"*, *"kilomita iri abụo
     * na atọ"*, *"kilogram 25"*, *"sentimita 60-80"*, *"kilomita 115 (71 mi)"*.
     *
     * ⚠ The artifact's DIGIT+ABBREVIATION instances are uniformly number-first (*"773 km"*, *"1,287 mm"*,
     * *"124 kg"*) and that is NOT counter-evidence — it is the written layout of the abbreviation, the exact
     * split `percentPrefix` above already records for `%`. The minority spoken order is real (*"na-aga ihe
     * ruru iri kilomita kwa ụbọchị"*) and is the documented 16% cost of picking the majority.
     */
    unitPrefix: true,
    /**
     * `skwea`, position `after` — *kilomita skwea 7,223*. See SQUARED in the header: the modifier follows its
     * noun in every attestation and `unitPrefix` then puts the number after both, which is the attested
     * three-part shape exactly. `cubed` is deliberately absent — no `km³` in the artifact and no word found.
     */
    exponentWords: { squared: ["skwea"], position: "after" },
    /** `na` — the ordinary Igbo connective, and the same word the number compositor uses to join parts. */
    ampersand: "na",
});

/** The thousands separator is a COMMA and the decimal separator a PERIOD — the Nigerian/English convention. */
const GROUPED = /(\d),(\d{3})(?!\d)/gu;
/** A decimal period. Voiced as `ntụkpọ` — see rule 4. */
const DECIMAL = /(\d)\.(\d+)/gu;
/** A digit-flanked dash. See rule 2 for why this is a RANGE and never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;

/**
 * A letter fused to the front of a QUANTITY — the space rule 2b restores. ⚠ Derived from `UNIT`, so a key
 * added there is covered here without a second edit; see rule 2b for what goes wrong without it.
 */
const FUSED_QUANTITY = new RegExp(
    String.raw`(\p{L})(?=\d[\d.,]*\s*(?:${Object.keys(UNIT).join("|")})(?:[²³23])?(?![\p{L}\p{M}\d]))`,
    "giu",
);

/** Normalize Igbo text: symbols the reader voices become words, before `igbo.ts`'s TOKEN ever sees them. */
export function normalizeIgbo(text: string): string {
    let s = text;

    // 1. De-group thousands FIRST: a grouping comma left in place makes the number two numbers with a pause
    //    between them (`1,500` → *otu , naɾɪ ise*, "one, five hundred").
    //    ⚠ EXACTLY THREE FOLLOWING DIGITS, so a decimal comma cannot be eaten. Applied repeatedly for numbers
    //    with several groups (1,234,567).
    while (GROUPED.test(s)) {
        GROUPED.lastIndex = 0;
        s = s.replace(GROUPED, "$1$2");
    }

    // 2. ⚠ A DIGIT-FLANKED DASH IN IGBO IS A RANGE, NOT A MINUS — overwhelmingly year-year (`1967-1970`) or
    //    page-page (`peeji 90-120`). A minus rule here would read every date range as arithmetic, which is why
    //    nl, mr, ta and yue all record their minus as an ACCEPTED silence. `ruo` is "to, until".
    s = s.replace(RANGE, "$1 ruo ");

    // 2b. ⚠ A LETTER FUSED TO A QUANTITY, SEPARATED — because `unitPrefix` MOVES THE UNIT NOUN LEFTWARD and a
    //     missing space in the source then swallows it. The artifact's *"mpaghara ala198 km2"* (no space, and
    //     the corpus is full of such joins) read *mpaɣaɾa ala otu naɾɪ …* before units existed, because the
    //     number path inserts its own boundary — but the unit rule rewrites `198 km2` to `kilomita skwea 198`
    //     starting AT the digit, so the noun lands against `ala` and the utterance gained a fused word,
    //     *alakilomita*. One utterance in 459, and a defect this layer introduced rather than found.
    //
    //     Deliberately NARROW: it fires only when a DECLARED UNIT follows the digits, which is what makes the
    //     digit run a quantity by construction. A general letter/digit split would break `Il-76`-shaped
    //     designations and every alphanumeric name in the corpus.
    //
    //     ⚠ BEFORE the tier, and after the range rule so `ala198-200 km` is already two numbers.
    s = s.replace(FUSED_QUANTITY, "$1 ");

    // 3. The shared symbol tier.
    s = SYMBOLS(s);

    // 4. The decimal separator, LAST — the order is load-bearing. Run before the tier, this splits `8.3%` into
    //    `8 3%` and the percent word lands BETWEEN the halves (*asatɔ pasent atɔ*, "eight percent three"); the
    //    tier's number pattern spans `8.3`, so it must see the number whole.
    //
    //    ⚠ Leaving it alone is not neutral either: `igbo.ts`'s TOKEN treats `.` as clause punctuation, so `2.5`
    //    reads *abʊɔ . ise* — a sentence break inside a number.
    //
    //    `ntụkpọ` comes from a dictionary, not the corpus, which contains no instance of it (the near-miss
    //    `ntụpọ` means a SPOT). Shipped UNTONED, matching the register of every other word here and the fact
    //    that `igbo.ts` reads tone only when written.
    //
    //    The FRACTION stays digit-by-digit after the word: `3.14159` is "three point one four one five nine".
    s = s.replace(
        DECIMAL,
        (_m, whole: string, frac: string) => `${whole} ${MANIFEST.numbers.decimalWord} ${[...frac].join(" ")}`,
    );

    // A sentence-final period is untouched: DECIMAL requires a digit on BOTH sides.
    return s;
}
