/**
 * Latvian (lv) TEXT NORMALIZATION — the pre-pass that turns written figures, signs and abbreviations into
 * Latvian words before the g2p sees them. Pure text→text, wired into `latvian.ts`'s `text()`.
 *
 * ⚠ THE ORDER BELOW IS LOAD-BEARING and the steps are numbered for that reason. De-grouping must precede the
 * number reader (or `29 660` is read as two numbers), the ordinal dot must precede everything that consumes a
 * period, and the decimal comma must come LAST — the shared tier matches `7,6%` as one figure-plus-sign, and
 * converting the comma first breaks that adjacency and drops the percent.
 *
 * WHAT WAS ACTUALLY WRONG, measured on the mined artifact (460 segments) before any of this existed:
 *
 *   `1885. gada 15. jūlijs`  → *tūkstotis … pieci . gada piecpadsmit . jūlijs*
 *        a CARDINAL where Latvian writes an ordinal, and — worse — the ordinal period was taken for a full
 *        stop, so a SENTENCE BREAK landed in the middle of a date. 262 dotted sites in the artifact.
 *   `12—18 °C`               → *divpadsmit astoņpadsmit t͡s*
 *        the range word gone, the degree sign gone, and ⟨C⟩ read as Latvian /t͡s/ — a plausible syllable
 *        rather than audible garbage, which is playbook trap 56, the same defect Basque's `º` reached by a
 *        different route. No leak class, no DROP and no referee can see it.
 *   `29 660 km²`             → *divdesmit deviņi seši simti sešdesmit km*
 *        the VALUE destroyed (29 660 read as 29 and 660), `km` raw in the IPA, `²` dropped.
 *   `56,4°`                  → *piecdesmit seši , četri*
 *        the decimal comma taken for a clause pause.
 *   `$230 000`               → *divi simti trīsdesmit nulle*
 *        the sign dropped and the value destroyed.
 *
 * SOURCING. espeak-ng's `lv_list` declares the sign readings directly (`%` → pRotsenti, `°` → gRa:di, `$` →
 * dola:Ri, `€` → eiRo:, `£` → ma:Rtsin^as, `=` → viena:ds, `×` → Reiz, `÷` → dali:ts, `±` → plusmi:nuss,
 * `_,` → komats); every unit noun and both scale names are attested on lv.wikipedia via `attest.ts`, with the
 * counts recorded at each declaration. Where the two tiers agree they are both cited, because agreement
 * between an independent pronunciation dictionary and running text is the strongest evidence available here.
 */
import { makeSymbolNormalizer, type CountForms } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { HEAD_NOUN, ordinalWords } from "./ordinals.ts";

/**
 * Latvian AGREEMENT for a counted noun: SINGULAR after a count ending in ...1 but NOT ...11 — *21 procents*,
 * *101 kilometrs* — and plural otherwise. This is not a new claim: `numbers.ts` already implements exactly
 * this rule as `agree()` for its own magnitude nouns (*tūkstotis* vs *tūkstoši*), so the tier is being handed
 * the compositor's own agreement rather than a second opinion about it.
 */
const countForm = (n: number): number => (n % 10 === 1 && n % 100 !== 11 ? 0 : 1);

/**
 * `[singular, plural]`, in the order `countForm` indexes them.
 *
 * ⚠ NOT USED FOR `percent` OR `currency`, and that is not an inconsistency. `review.ts`'s sourcing gate reads
 * those two declarations STATICALLY out of the source text, so a helper call it cannot evaluate makes the
 * check pass while having verified nothing — playbook trap 57, an instrument failing toward false confidence.
 * It reported exactly that here. Those two are written as literal arrays so the gate can see them.
 */
const pair = (one: string, many: string): CountForms => [one, many];

/**
 * THE UNIT NOUNS. Every singular is attested on lv.wikipedia as a whole token (`attest.ts`, tok/arts):
 * kilometrs 9/2, metrs 8/1, centimetrs 4/2, milimetrs 6/2, kilograms 5/2, grams 6/2, hektārs 4/2, tonna 9/2.
 * The plurals are the regular first-declension `-i` (and `tonnas`, 6/1 — `tonna` is FEMININE, which is why
 * its plural is not `-i`; getting that from the paradigm rather than by analogy is the point of listing it).
 *
 * ⚠ ONE-LETTER KEYS ARE THE HAZARD (playbook trap 46). `m`, `g` and `t` are also ordinary Latvian letters and
 * a bare `76t` is as likely to be a designation as a tonnage — the tier's own boundary guards are what make
 * these safe, and they are declared here only because the corpus writes all three after a number: m×8, g×5,
 * kg×7, ha×5. `s` is deliberately NOT here; it lives in `rateDenominators` for the reason that field exists.
 */
const UNITS: Record<string, CountForms> = {
    km: pair("kilometrs", "kilometri"),
    m: pair("metrs", "metri"),
    cm: pair("centimetrs", "centimetri"),
    mm: pair("milimetrs", "milimetri"),
    kg: pair("kilograms", "kilogrami"),
    g: pair("grams", "grami"),
    ha: pair("hektārs", "hektāri"),
    // ⚠ FOUND BY THE LEAK GATE, not by reading the corpus: `610 nm` reached the IPA as a raw Latin `nm`
    // because the unit was simply not declared. `nanometrs` 3 tok / 2 arts.
    nm: pair("nanometrs", "nanometri"),
    t: pair("tonna", "tonnas"),
};

/**
 * ⚠ THE RATE READING IS ATTESTED DEFINITIONALLY, which is the strongest form this evidence takes:
 *   *"Kilometri stundā, saīsinājums km/h, ir ātruma mērvienība."*
 *   — "Kilometres per hour, abbreviated km/h, is a unit of speed."
 * The wiki states the abbreviation and its reading in one sentence. Note what that sentence shows: Latvian
 * uses NO preposition — the denominator simply stands in the LOCATIVE (*stundā*, *sekundē*). `unitPer` is
 * therefore the empty string, not a word; the locative IS the "per". `stundā` 9 tok / 2 arts, `sekundē` 12/2.
 *
 * ⚠ `sek` IS DECLARED BESIDE `s` because the corpus writes it: `71 km/sek./Mpc`. Without the longer key the
 * denominator does not match, the whole rate fails, and `km` reaches the IPA raw — which is how this was
 * found, as a RAW-LATIN leak rather than as a missing word.
 */
const RATE_DENOMINATORS: Record<string, string> = { h: "stundā", s: "sekundē", sek: "sekundē" };

/**
 * The SIGN words, all from espeak-ng `lv_list` and cross-checked against lv.wikipedia where a token exists:
 * vienāds 6 tok / 2 arts, dalīts 5/2, reiz 8/2, mīnuss 1/1, procenti 10/3, promiles 5/2.
 *
 * ⚠ `plusmīnuss` IS THE ONE WORD WITH NO WIKIPEDIA TOKEN (0/0) and it is declared anyway, on espeak's
 * `± plusmi:nuss` alone. Said rather than implied: `±` is a single code point, so no `+` rule can reach
 * inside it, and without an entry the sign vanishes silently. A one-tier word is weaker evidence than a
 * two-tier one and this is the only place in the file relying on it.
 */
const SIGN = {
    plus: "plus",
    minus: "mīnuss",
    plusMinus: "plusmīnuss",
    equals: "vienāds",
    lessThan: "mazāks par",
    greaterThan: "lielāks par",
    times: "reiz",
    dividedBy: "dalīts",
    ampersand: "un",
    approximately: "aptuveni",
} as const;

/**
 * THE SCALE NAMES. `Celsija grāds (°C) ir temperatūras mērvienība` is the wiki's own defining sentence — the
 * reading and the sign in one clause — and `Celsija` is 8 tok / 3 arts, `grāds` 10/2. Fahrenheit is
 * `Fārenheits` 5/2 (genitive `Fārenheita`).
 *
 * ⚠ FAHRENHEIT IS ROBUSTNESS, NOT A MEASURED REPAIR (playbook trap 22): `°F` is ×0 in this corpus. It is
 * declared because the arm exists for Celsius anyway and an unmatched `°F` would leave ⟨F⟩ to be read as a
 * letter — the same class of defect as the ⟨C⟩ this step was written to stop.
 */
const SCALE: Record<string, CountForms> = {
    C: pair("Celsija grāds", "Celsija grādi"),
    F: pair("Fārenheita grāds", "Fārenheita grādi"),
};
const DEGREE: CountForms = pair("grāds", "grādi");

const SYMBOLS = makeSymbolNormalizer({
    // espeak `% pRotsenti`; attest procenti 10 tok / 3 arts, procentu 17/3, procents 2/1.
    percent: ["procents", "procenti"],
    // espeak `$ dola:Ri`, `€ eiRo:`, `£ ma:Rtsin^as`. ⚠ `eiro` is INDECLINABLE in Latvian — one form for
    // both counts, which is why the pair repeats rather than inventing a plural.
    currency: {
        $: ["dolārs", "dolāri"],
        "€": ["eiro", "eiro"],
        "£": ["mārciņa", "mārciņas"],
    },
    units: UNITS,
    /**
     * The compositor's own magnitude words (`latvian.jsonc` → numbers), so a figure separated from its unit by
     * one of them is still adjacent to it: the corpus writes `45,46 miljardi USD` and `$1 miljards`.
     *
     * ⚠ THE INFLECTED FORMS ARE NOT OPTIONAL, and declaring only the nominative was a real defect. Latvian
     * declines its magnitude nouns like any other, and the corpus writes the oblique forms MORE often than the
     * nominative: miljoniem ×6, miljonu ×5, miljardus ×4, tūkstošiem ×3, miljardiem ×2. The tier matches a
     * magnitude with no trailing word boundary — its own Russian note (миллион / миллионов) says exactly this —
     * so the short form matched and stranded the suffix: the file's own quoted `$17.37 miljardiem` came out
     * *miljardi dolāri EM*, a stray syllable sent to the g2p. The `-u`/`-us` forms failed differently and
     * worse: no match at all, so the figure was not adjacent to the sign and the currency was DROPPED.
     * Longest-first ordering is the tier's job, not this list's.
     */
    magnitudes: [
        "miljardiem", "miljardus", "miljardi", "miljardu", "miljards",
        "miljoniem", "miljonus", "miljoni", "miljonu", "miljons",
        "tūkstošiem", "tūkstošus", "tūkstoši", "tūkstošu", "tūkstotis",
    ],
    rateDenominators: RATE_DENOMINATORS,
    unitPer: "",
    /**
     * ⚠ `compound`, NOT `after`. Latvian fuses the square word onto the front of the noun —
     * *kvadrātkilometri*, one word (attested 2 tok / 2 arts; `kvadrātmetri` 1/1, `kubikmetri` 1/1). Declaring
     * `after` would emit *kilometri kvadrāt*, and `before` *kvadrāt kilometri*; neither is a Latvian word.
     */
    exponentWords: { squared: ["kvadrāt"], cubed: ["kubik"], position: "compound" },
    // `kvadrātā` (22 tok / 2 arts) is the PREDICATE form — *pieci kvadrātā*, "five squared" — and is a
    // different word-shape from the modifier above, which is why the tier keeps the two fields apart.
    bareExponent: { squared: "{n} kvadrātā", cubed: "{n} kubā", power: "{n} pakāpē {e}", negative: SIGN.minus },
    multiply: { times: SIGN.times },
    ampersand: SIGN.ampersand,
    countForm,
});

/**
 * 1. The spaces Latvian groups digits with: ASCII, NO-BREAK (U+00A0) and NARROW NO-BREAK (U+202F). Written as
 * ESCAPES rather than literal characters — the three are indistinguishable on the page, and a rule whose
 * correctness cannot be read off the source is a rule nobody can review.
 */
const GROUP_SPACE = /(?<=\d)[ \u00a0\u202f](?=\d{3}(?!\d))/gu;

/**
 * 2. DOTTED ABBREVIATIONS — and the reason this runs before the ordinal step is that its periods are the
 * same periods.
 *
 * ⚠ EACH DOT WAS A CLAUSE BREAK AND EACH FRAGMENT A FAKE WORD. `p.m.ē.` — the era marker, ×20 in the
 * retained text and 1,008 corpus-wide — was reading as *p . m . ēː .*: three letter-fragments and FOUR
 * pauses inside what is one three-word phrase. `u.c.` came out *u . t͡s .*, `t.i.` as *t . i*. Nothing in the
 * pipeline could see this: no digit leaks, no sign is dropped, and every fragment is a legal Latvian sound.
 *
 * ⚠ ONLY INVARIANT EXPANSIONS ARE HERE. Every entry below is a fixed phrase or an adverb that does not
 * inflect, so expanding it claims no case. `gs.` (gadsimts), `izd.` (izdevums) and bare `sk.` are
 * DELIBERATELY ABSENT for exactly the reason the ordinal table is closed: the abbreviation HIDES the noun's
 * case, and `XII gs. Rietumeiropā` wants the locative while `(10.–12. gs.)` wants the nominative. Expanding
 * to a citation form would put a real Latvian word in the wrong case — worse than the raw `gs` a RAW-LATIN
 * gate can see. They stay red until the case is derivable.
 *
 * SOURCING — `attest.ts` on lv.wikipedia, tok/arts: `pirms mūsu ēras` 4/3, `mūsu ēras` 4/3, `tai skaitā` 4/3,
 * `tamlīdzīgi` 3/3, `piemēram` 34/3, `un citi` 10/6, `un tā tālāk` 8/6, `tas ir` 4/4, `pulksten` 10/3.
 * ⚠ THE LAST FOUR NEEDED A WIDER SAMPLE, and that is worth recording: at `--limit 3` they came back ABSENT,
 * and at `--limit 12` all four are attested. An instrument failing toward false ABSENCE is the safe
 * direction, but it is still a failure, and a zero from a three-article probe is not evidence.
 */
const ABBREVIATION: Readonly<Record<string, string>> = {
    "p.m.ē.": "pirms mūsu ēras",
    "m.ē.": "mūsu ēras",
    "u.tml.": "un tamlīdzīgi",
    "u.t.t.": "un tā tālāk",
    "t.sk.": "tai skaitā",
    "utt.": "un tā tālāk",
    "u.c.": "un citi",
    "t.i.": "tas ir",
    "piem.": "piemēram",
    "plkst.": "pulksten",
};

/** Longest key first, so `m.ē.` cannot claim the tail of `p.m.ē.` and `t.t.` cannot split `u.t.t.`. */
const ABBREVIATION_RE = new RegExp(
    `(?<![\\p{L}\\p{M}.])(?:${Object.keys(ABBREVIATION)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("|")})`,
    "giu",
);

/**
 * `lpp.` and `nr.` are counted nouns rather than fixed phrases, so they take the agreement rule — `160 lpp.`
 * is *simts sešdesmit lappuses* and `1 lpp.` *viena lappuse*. `lappuse` 7 tok / 3 arts, `lappuses` 18/3,
 * `numurs` 25/3. ⚠ `nr.` PRECEDES its figure (`nr. 859`) and so takes the citation nominative — there is no
 * preceding count for it to agree with, which is why it is a plain string and not a pair.
 */
const PAGE: CountForms = pair("lappuse", "lappuses");
const NUMBER_ABBREV = "numurs";

function abbreviations(text: string): string {
    return text
        // the counted one first: it needs the figure that the generic rule would not look at
        // ⚠ THE TRAILING DOT IS OPTIONAL, because the corpus's one instance does not write it: the
        // bibliography line ends `— 160 lpp` with no period at all. A required dot left it as a raw leak.
        // Safe here in a way it would not be for `nr`, since `lpp` is not a word or a plausible fragment.
        .replace(/(?<![\p{L}\p{M}])(\d+)(\s*)lpp\.?(?![\p{L}\p{M}])/giu, (_w, fig: string, gap: string) => `${fig}${gap || " "}${PAGE[countForm(Number(fig))]}`)
        .replace(/(?<![\p{L}\p{M}.])nr\.(?=\s*\d)/giu, NUMBER_ABBREV)
        .replace(ABBREVIATION_RE, (m: string) => ABBREVIATION[m.toLowerCase()] ?? m);
}

/**
 * 3. AN ORDINAL RANGE — `18.—20. gadsimtā`, `60.—70. gados`, `469.–399. gads`. Both figures are ordinals and
 * BOTH agree with the one noun that follows, so the case is read off that noun exactly as in the single
 * case; the dash is the range word this file already sources (`līdz`, 55 standalone tokens).
 *
 * ⚠ THIS RUNS ABOVE BOTH `ordinalPeriod` AND `RANGE`, and it has to. `ordinalPeriod` would claim the SECOND
 * figure alone and leave the first as a bare cardinal with its period intact — which is what the layer did
 * before this step, producing *astoņpadsmit . divdesmitajā gadsimtā*, a false clause break inside the range.
 * `RANGE` would replace the dash first and destroy the shape this pattern matches on.
 *
 * ⚠ EVERY ONE of the 17 ordinal-range sites in the retained text is followed by a tabulated head noun
 * (`gadsimtā`, `gadsimtu`, `gadsimtam`, `gados`, `gadu`, `gads`), which is why this is worth a step rather
 * than a guess: the case is stated in all 17. Where it is not — `10.–12. gs.`, the abbreviation that hides
 * its case — the whole match is refused and left alone (trap 53), not half-composed.
 */
const ORDINAL_RANGE = /(?<![\d.,\p{L}])(\d{1,4})\.\s*[-–—]\s*(\d{1,4})\.(\s+)(\p{Ll}[\p{L}\p{M}]*)/gu;

function ordinalRange(text: string): string {
    return text.replace(ORDINAL_RANGE, (whole, a: string, b: string, gap: string, next: string) => {
        const c = HEAD_NOUN[next.toLowerCase()];
        const first = c === undefined ? undefined : ordinalWords(Number(a), c);
        const second = c === undefined ? undefined : ordinalWords(Number(b), c);
        /**
         * ⚠ REFUSING MEANS BOTH HALVES, AND IT MUST STILL CONSUME THE PERIODS. Returning `whole` here looked
         * like a clean refusal and was not: the next step ran on the same text, matched the SECOND figure on
         * its own and composed it, so `3100.–1550. gadam` — refused here because 3100 is a round hundred —
         * came out *3100.–tūkstoš pieci simti piecdesmitajam gadam*, one figure ordinalised and the other
         * left with its period. A refusal that the following step can undo is not a refusal (trap 53).
         *
         * So a refused range falls back to the SAME half-measure the single-ordinal step uses: both periods
         * dropped, both figures left cardinal, the dash read as `līdz`. `10.—12. gs.` → *10 līdz 12 gs.* —
         * the ordinals are not claimed, and neither are the two false sentence breaks.
         */
        if (first === undefined || second === undefined) return `${a} līdz ${b}${gap}${next}`;
        return `${first} līdz ${second}${gap}${next}`;
    });
}

/**
 * 4. THE ORDINAL PERIOD — the largest class in the language and the one that was doing real damage.
 *
 * Latvian marks an ordinal with a period after the figure, and the period is NOT a sentence end. Two things
 * were wrong before this step: the figure was read as a cardinal, and the clause layer took the dot for a
 * full stop and inserted a pause inside the date.
 *
 * ⚠ THE CASE IS READ OFF THE FOLLOWING NOUN, never guessed — see `ordinals.ts`. `gada` is genitive so the
 * ordinal is `-ā`, `gadā` locative so it is `-ajā`. 205 of the artifact's 262 dotted sites (78%) are followed
 * by one of the tabulated nouns.
 *
 * ⚠ WHAT THE OTHER 22% GET, and this is a deliberate, measured half-measure rather than an oversight. With no
 * tabulated noun the case is genuinely underivable, so no ordinal is composed — but the PERIOD IS STILL
 * REMOVED, because that it is not a full stop is a fact about Latvian orthography (a sentence does not
 * continue in lower case) and is independent of which case the ordinal takes. The figure stays a cardinal,
 * which is wrong; a spurious sentence boundary in mid-clause is worse, and unlike the cardinal it also
 * corrupts every following clause's prosody. Both halves are stated here so the trade can be re-decided.
 *
 * ⚠ THE OBVIOUS EXTENSION IS REFUSED, AND WHY IT IS REFUSED IS THE WHOLE ARGUMENT FOR THE CLOSED SET. The
 * corpus writes `no 1990. līdz 1995. gadam` — the second figure is tabulated, the first is followed by `līdz`
 * and is not — and the preposition `no` governs the genitive unambiguously, so the case looks derivable from
 * the word BEFORE the figure. It is not, because the ordinal agrees in GENDER with a noun that may be several
 * words away: `no 5. līdz 10. klasei` is *no piektāS līdz desmitajai klasei*, feminine, and the masculine
 * `piektā` this file would compose is a different word. The table is closed to masculine head nouns precisely
 * so that gender never has to be inferred; a preposition carries case but not gender. `2. vietā` (feminine)
 * is left alone for the same reason, and correctly.
 *
 * ⚠ AN ORDINAL RANGE IS NOT HANDLED, and it is a real cell — `ordinal-range` is 9,936 corpus-wide. `9.—10.
 * maijs` composes only its SECOND ordinal (*9.—desmitais maijs*), because the first is followed by a dash
 * rather than by a noun. Reading it properly needs BOTH ordinals in cases the dash does not state — *no
 * devītā līdz desmitajam maijam*, genitive then dative — which is the same underivable-case problem as above,
 * arriving from a third direction. Left alone rather than half-composed: it is strictly better than the
 * pre-layer reading (one false clause break removed, the second ordinal correct) and is a candidate for its
 * own step, not for a guess here.
 *
 * ⚠ THE GUARD IS `\s+` PLUS A LOWER-CASE LETTER. A digit after the dot is a decimal point or a clock time in
 * a foreign convention (the corpus has `$17.37 miljardiem` and `ap 16.00`), and an upper-case letter after it
 * is an ordinary sentence boundary. Neither may be touched.
 */
function ordinalPeriod(text: string): string {
    return text.replace(/(?<![\d.,])(\d{1,4})\.(\s+)(\p{Ll}[\p{L}\p{M}]*)/gu, (whole, fig: string, gap: string, next: string) => {
        const c = HEAD_NOUN[next.toLowerCase()];
        if (c === undefined) return `${fig}${gap}${next}`; // period dropped, figure left cardinal — see above
        const words = ordinalWords(Number(fig), c);
        /**
         * ⚠ A REFUSED ORDINAL STILL LOSES ITS PERIOD. Returning `whole` here put the dot back, which
         * contradicted this step's own policy two paragraphs up: the untabulated-noun branch drops it because
         * it is never a full stop, and that reason does not depend on whether the ordinal could be composed.
         * `200. gadā` and `1900. gadā` were keeping the spurious sentence break inside a date — the exact
         * defect this step exists to remove. 8 of 262 sites.
         */
        return words === undefined ? `${fig}${gap}${next}` : `${words}${gap}${next}`;
    });
}

/**
 * 5. RANGES — *54—57%*, *12—18 °C*, *1615—1684*. The word is `līdz`, which is the corpus's own: 55 standalone
 * tokens across 102 segments, and the corpus writes the collocation `no 12—18 °C` where `no … līdz` is the
 * ordinary frame, so the dash is standing in for exactly this word.
 *
 * ⚠ RUNS BEFORE THE SIGN STEP, which is what keeps `–` from being read as `mīnuss`. espeak's `lv_list` maps a
 * bare en dash to `mi:nuss`, and that is right for an isolated sign and wrong between two figures; ordering
 * decides it rather than a guard.
 *
 * ⚠ DECIMAL OPERANDS ARE ALLOWED (`0,3—0,6 mm`) because this runs above the decimal step, so the comma is
 * still part of the figure here.
 *
 * ⚠ A CHAINED HYPHEN IS NOT A RANGE, which is why the guards exclude a hyphen on either flank. An ISO date
 * `2020-05-17` was reading as *2020 līdz 05-17* — the first pair claimed, the rest left as digits. Zero such
 * sites in this corpus, so this is robustness rather than a measured repair (trap 22).
 *
 * ⚠ WHAT IS *NOT* FIXED, said rather than implied: `Boeing 737-800` still reads as a range. All six ASCII
 * hyphens between digits in this corpus ARE ranges (`384-322`, `1841-1846`, `1890-1901`, `125-159`), so
 * refusing the ASCII form would cost more than it saves — and a model designation is not distinguishable from
 * a range by orthography alone. The en and em dashes carry no such ambiguity; only the ASCII hyphen does.
 */
/**
 * ⚠ THE TRAILING GUARD REJECTS A DIGIT, NOT A CLAUSE MARK — playbook trap 58, and the first cut of this file
 * walked straight into it. `(?![\d,.-])` was written to refuse a chained hyphen and a decimal tail, and it
 * also refused `1990-1995.` — a range at the end of a SENTENCE. The rule was right about every range that
 * happens not to end a clause, which is exactly how this trap presents: `no 1990-1995. gadam` came out with
 * the hyphen raw and no `līdz` at all. Found by a fleet sweep, not by this language's own gate, which treats
 * the range probes as ungated.
 */
const RANGE = /(?<![\d,.\p{L}-])(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)(?!\d|[,.]\d|-\d)/gu;

/**
 * 7. DEGREES. `°C` and `°F` take the scale name; a bare `°` after a figure is `grādi`.
 *
 * ⚠ COORDINATES ARE LEFT ALONE, and the reason is gender. `6°44'` reads *seši grādi četrDESMIT ČETRAS
 * minūtes* — `minūte` is feminine, and `numbers.ts` documents its numerals as masculine-default with gender
 * explicitly deferred, so composing the minutes would emit *četri minūtes*: a confidently wrong agreement in
 * place of a dropped mark. 4 sites in the artifact. The bare-degree arm below still reads their `°`, which is
 * why the pattern does not require the degree to end the figure.
 */
/**
 * ⚠ THE WHITESPACE AFTER `°` IS ONLY CONSUMED WHEN A SCALE LETTER IS ACTUALLY TAKEN, and the first cut's
 * `\s*([CF])?` consumed it unconditionally: `6° virs nulles` — the corpus's own line — came out
 * *6 grādivirs nulles*, one word where there were two.
 *
 * ⚠ AND THE SCALE LETTER NEEDS A LETTER BOUNDARY. Without it `20° Celsija skalā` matched the ⟨C⟩ of *Celsija*
 * as the scale and left *elsija* behind — a truncated word reaching the g2p. With the boundary the group
 * simply declines, and the bare-degree arm reads it as *20 grādi Celsija skalā*, which is the right sentence.
 */
const DEGREE_SIGN = /(\d+(?:,\d+)?)\s*°(?:\s*([CF])(?![\p{L}\p{M}]))?/gu;

function degrees(text: string): string {
    return text.replace(DEGREE_SIGN, (whole: string, fig: string, scale: string | undefined, offset: number, full: string) => {
        const forms = scale ? SCALE[scale]! : DEGREE;
        /**
         * ⚠ A FIGURE WITH A FRACTION TAKES THE PLURAL, whatever its integer part. `21,5` ends in ...1 by
         * `countForm`'s arithmetic but is read *divdesmit viens komats pieci GRĀDI* — the singular agrees with
         * a count of exactly one, and 21,5 is not one. Taking the integer part would have said *grāds*.
         */
        const word = forms[fig.includes(",") ? 1 : countForm(Number(fig))]!;
        /**
         * ⚠ THE EMITTED NOUN MUST NOT FUSE WITH WHAT FOLLOWS — the same defect, and the same fix, as the shared
         * tier's currency arm (test/core-currency-fusion.test.ts). `6500°K` has no space to inherit, so without
         * this the output is *grādiK*: ONE Latin run, one bogus stressed word, and the raw ⟨K⟩ hidden inside it
         * where the RAW-LATIN gate cannot see it. Separating leaves the unread letter visible instead.
         */
        const fuses = /^[\p{L}\p{M}]/u.test(full.slice(offset + whole.length));
        return `${fig} ${word}${fuses ? " " : ""}`;
    });
}

/**
 * 8. THE REMAINING SIGNS. `+34,5 °C` and `+5 °C` are the corpus's shape — a sign attached to an amount rather
 * than an operator between two — and both readings are the same word in Latvian, so no split is needed.
 *
 * ⚠ THE ASCII HYPHEN IS A MINUS HERE, and excluding it was a mistake `review.ts` caught: espeak maps bare `-`
 * to *defise* ("hyphen") and `–` to *mīnuss*, so the first cut followed espeak and dropped `-5` entirely. But
 * espeak is describing an ISOLATED mark, and a hyphen bound to a following figure at a non-digit boundary is
 * a sign, not punctuation. The range step above has already consumed every digit-hyphen-digit, so nothing
 * ambiguous is left for this to claim.
 *
 * ⚠ `=`, `<` AND `>` ARE READ RATHER THAN LEFT SILENT, which reverses this file's first draft. The argument
 * for silence was that the corpus's sites are formulae (`I = L/4πd²`, `y = a + bx`) whose surroundings are not
 * being read as Latvian anyway — but that argument justifies dropping the SIGN, and a dropped sign is
 * inaudible, so nothing downstream can ever tell that the equation lost its verb. All three words are sourced
 * (espeak `= viena:ds`, `_< m'aza:ks||p'aR`, `_> l'iela:ks||p'aR`; `vienāds` 6 tok / 2 arts and `mazāks` 1/1
 * on the wiki, `lielāks` 0/0 — espeak-only, and said rather than implied).
 */
/**
 * ⚠ AN EQUALS SIGN MUST BE OPERAND-FLANKED AND NOT PART OF A LONGER OPERATOR. The first cut replaced every
 * `=` unconditionally, and self-review caught two defects it produced rather than repaired:
 *   `a==b`           → *a vienāds  vienāds b* — the word said TWICE, and a DOUBLE SPACE, which is the
 *                      SLOT-GAP class the fleet-wide audit exists to find
 *   `url?q=1&t=2`    → *url?q vienāds 1 un t vienāds 2* — a query string read aloud as arithmetic
 * Both are readings rather than drops, so no leak gate would have shown them. The flanking requirement and
 * the `[=!<>]` guards are the same discipline `<` and `>` need, and for the same reason.
 */
const EQUALS = /(?<![=!<>])(?<=[\d\p{L}\p{M})²³])\s*=\s*(?=[\d\p{L}(])(?![=<>])/gu;

function signs(text: string): string {
    return text
        // `≈200 MPa`, `≈-20 °C` — the corpus writes it 4 times and the sign was vanishing outright.
        // `aptuveni` is the corpus's and the wiki's own word for it (4 tok / 2 arts).
        .replace(/≈\s*(?=[+−–-]?\d)/gu, `${SIGN.approximately} `)
        .replace(/(?<![\d\p{L}])±(?=\s?\d)/gu, `${SIGN.plusMinus} `)
        .replace(/(?<![\d\p{L}])\+(?=\s?\d)/gu, `${SIGN.plus} `)
        .replace(/(?<![\d\p{L}])[−–-](?=\s?\d)/gu, `${SIGN.minus} `)
        .replace(/(?<=\d)\s*÷\s*(?=\d)/gu, ` ${SIGN.dividedBy} `)
        .replace(EQUALS, ` ${SIGN.equals} `)
        .replace(/(?<![=!<>])(?<=[\d\p{L}])\s*<\s*(?=[\d\p{L}])(?![=<>])/gu, ` ${SIGN.lessThan} `)
        .replace(/(?<![=!<>])(?<=[\d\p{L}])\s*>\s*(?=[\d\p{L}])(?![=<>])/gu, ` ${SIGN.greaterThan} `);
}

/**
 * 9. THE DECIMAL COMMA — Latvian's decimal separator, and the word is `komats` (espeak `_, komats`; attest
 * 23 tok / 3 arts). Runs LAST: the shared tier matches `7,6%` as one figure, and converting the comma before
 * it would break that adjacency and drop the sign.
 *
 * ⚠ EVERY LEADING ZERO IN THE FRACTION IS SPOKEN SEPARATELY. This is the Basque defect, found in review there
 * and prevented here: reading the fraction as a NUMBER makes `5,09` and `5,9` identical, because `Number("09")`
 * is 9 — the quantity wrong by a factor of ten, in perfectly well-formed text, invisible to every gate. The
 * zeros are emitted as words and only the remainder is read as a number.
 */
function decimalComma(text: string): string {
    return text.replace(/(?<![\d,.])(\d+),(\d+)(?![\d,.])/gu, (whole, head: string, frac: string) => {
        if (head.length > 15 || frac.length > 15) return whole;
        const zeros = /^0*/u.exec(frac)![0];
        const rest = frac.slice(zeros.length);
        const spoken = [...zeros].map(() => numberToWords(0));
        if (rest !== "") spoken.push(numberToWords(Number(rest)));
        return `${numberToWords(Number(head))} komats ${spoken.join(" ")}`.trimEnd();
    });
}

/** The Latvian normalization pre-pass. See the numbered steps above; the order is load-bearing. */
export function normalizeLatvian(input: string): string {
    let s = input;
    s = s.replace(GROUP_SPACE, ""); // 1. de-group 29 660 → 29660, before anything reads a number
    s = abbreviations(s); // 2. dotted abbreviations, whose periods are the same periods as step 4's
    s = ordinalRange(s); // 3. N.–M. + noun, before either half can be claimed separately
    s = ordinalPeriod(s); // 4. the ordinal period, before any step consumes a dot
    s = s.replace(RANGE, `$1 līdz $2`); // 5. ranges, before a dash can be read as a minus
    s = SYMBOLS(s); // 6. percent, currency, units, rates, exponents
    s = degrees(s); // 7. ° and the scale names
    s = signs(s); // 8. the remaining signs
    s = decimalComma(s); // 9. the decimal comma, last — the tier needs the figure intact
    return s;
}
