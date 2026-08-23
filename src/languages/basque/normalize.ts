/**
 * Basque / Euskara (eu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ AN ISOLATE, SO THERE IS NO SIBLING TO READ AND NONE TO MIS-COPY. Playbook trap 55 cannot bite here, and
 * that cuts both ways: every reading below had to be sourced from Basque's own evidence, and where it could
 * not be, the class is declined. Sources, in the order this repo ranks them: the mined corpus
 * (`tools/corpus/mined/eu.jsonc`, 463 retained segments — there is no FLEURS eu on disk), espeak's
 * `dictsource/eu_list`, `attest.ts` against eu.wikipedia, and the 20,114-entry wikipron referee.
 *
 * ── WHAT WAS BROKEN ─────────────────────────────────────────────────────────────────────────────────────
 *
 *     42.262.142      → *berogeita bi . berehun … . ehun …*   ONE number read as three, with two pauses
 *     93,55           → *… hamahiru , berogeita hamabost*     the decimal comma read as a PAUSE
 *     % 32,1          → the sign silent                       ×112 — the largest class in the corpus
 *     2.000€ · £5     → the sign silent
 *     5 km · km²      → raw `km` in the IPA, exponent silent
 *     120 km/h        → *… km h*, the denominator as a bare letter
 *     56,7 ° C        → degree silent, and ⟨C⟩ read as /k/ — a REAL Basque grapheme (trap 56)
 *     1980an          → *… laurogei AN*, the case suffix stranded as its own word — ×296, the biggest class
 *
 * ── THE ONE THING THAT MAKES THE CASE SUFFIX TRACTABLE ──────────────────────────────────────────────────
 *
 * Basque glues a case ending to a figure and the ending's SHAPE depends on how the numeral is SPOKEN: after
 * a vowel `1980an` (*…laurogei-an*), after a consonant `1981ean` (*…bat-ean*). That is trap 14 — agreement
 * cannot be applied to digits — and in Mongolian and Kazakh it forces the layer to CHOOSE the allomorph.
 *
 * ⚠ HERE IT DOES NOT, BECAUSE THE AUTHOR HAS ALREADY CHOSEN IT. The suffix is written in the text, harmonised
 * to the form the writer had in mind, so the rule only has to ATTACH it to the last spoken word rather than
 * derive it. Verified across the corpus's endings — `an` ×124, `ko` ×54, `a` ×39, `ean` ×22, `tik` ×15,
 * `eko` ×14, `ra` ×5, `era`/`etik`/`koa` ×2 each — every one agreeing with its own numeral's final segment.
 * The rule therefore claims only the shapes the corpus writes and invents no morphology.
 *
 * ── WHAT IS DELIBERATELY NOT DONE ───────────────────────────────────────────────────────────────────────
 *
 *   · NO RANGES (43 `\d-\d` in the retained text). Reading them dissolves the class: `Tristia 4.10.41–54`,
 *     `Am 2.18.19-26`, `Am 2.18.19-26-en` are CLASSICAL CITATIONS, `(1235-1400)` and `(16-21)` are a reign
 *     and a card range, `0,1-0,5º` and `100.000-180.000 urte` have decimal or grouped operands this layer
 *     would have to re-implement inside the rule to keep intact. What is left is a handful, and no joiner is
 *     sourceable for it: Basque spans are `-tik … -ra` (ablative-to-allative), which is two agreeing suffixes
 *     on the two operands, not an infix — the Fula `hakkunde` shape, refused for the same reason. `N eta N`
 *     occurs ×10 and every one is an ordinary conjunction between two independent figures, not a span.
 *   · NO SUBTRACTION, TIMES OR DIVISION (`math-sign` ×14). ⚠ THE NEGATIVE SIGN *IS* NOW READ — see step 4b;
 *     this bullet said "no math signs" and was wrong about the one that was changing a VALUE. The corpus's `×` instances are `5.97×10²⁴` — scientific
 *     notation, where the reading is an exponent predicate this layer has no word for — and `2.000 – 1.000`
 *     inside a worked arithmetic example that spells its own operation out in words either side. `ken`
 *     (subtract) and `bider` (times) are ×0 as whole words in the corpus; `zati` ×9 is the noun "part"
 *     (*espektroaren zati garrantzitsutzat*), not the division word. Trap 37: a bare token in the wrong sense.
 *   · NO INITIALISMS, though the seam is FEEDABLE and this is the closest call in the file. espeak ships 33
 *     Basque letter names, so `core/initialisms.ts` could be wired — but it needs a `letterName` table in the
 *     manifest, which is its own sourcing pass, and the corpus's all-caps runs are dominated by foreign
 *     acronyms (`NASA`, `UNESCO`, `ESA`) that convention says as words. Recorded as WIREABLE rather than
 *     blocked, which is the distinction `sources.ts` exists to make.
 *   · NO AMPERSAND (×4, all `&nbsp;` entities that `core/markup.ts` decodes above this layer).
 *   · NO `gb`/`l`/`ppm`/`dm` units (×2/×2/×1/×1). Each is one or two instances with no attested Basque word
 *     in corpus, espeak or the wiki; `litro` and `gigabyte` are plausible and unsourced, and this file does
 *     not ship plausible.
 *   · NO `₹` (×1, `Indiako gobernuak 5 ₹ txanpon berezi bat`). `errupia`/`rupia` are ×0 in the corpus, and one
 *     instance of a foreign currency in a Basque encyclopedia article is not a reason to author a word.
 *
 *   · NO POPULATION DENSITY, which is the whole of the residual `km` leak. All eleven remaining instances are
 *     one shape — `(141 bizt./km²)`, `(71 bizt./km²)`, `(60 bizt./km²)` … one per country stub — where the
 *     NUMERATOR is a common noun abbreviated (`bizt.` = *biztanle*, inhabitants). No unit table can name that,
 *     which is the `bar Eihwohna/km²` case in the playbook's own list of "a declared unit that still reports".
 *     `km` and `km²` are declared and read correctly everywhere else; this shape needs a rate whose numerator
 *     is a noun, and the tier has no such thing.
 *
 * ── THE ONE RESIDUAL LEAK, NAMED RATHER THAN LEFT TO BE FOUND ───────────────────────────────────────────
 *
 * `LEAK RAW-LATIN kg ×1` survives, and it is the math-sign refusal arriving one hop out. The sentence is
 * `Lurraren masa 5,98x1024 kg da` — scientific notation with the exponent flattened by the corpus's own
 * typography, so the operand next to `kg` is preceded by a LETTER (`x`) and the shared tier's boundary guard
 * declines the whole match. Declaring `kg` did not and could not fix it; what would is a reading for `×10ⁿ`,
 * which this layer refuses for want of a word. The failure is a VISIBLE raw `kg` rather than a wrong
 * quantity, which is the direction to fail in — but it is a leak, and calling it anything else would be the
 * half-declared reading trap 53 warns about.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { cardinalWords } from "./basque.ts";

/**
 * The PERCENT reading, and the best-sourced word in this layer — the wiki states it DEFINITIONALLY, and
 * states the POSITION in the same sentence:
 *   *"batzuetan, euskara kasu, zenbakiaren aurretik jartzen da (ehuneko 5 esaten delako)"*
 *   — "sometimes, as in Basque, it is placed BEFORE the number, because one says *ehuneko 5*."
 * and *"letraz-letra idatzita ere adierazi daiteke: ehuneko hirurogei"* ("can also be written out in letters:
 * ehuneko hirurogei" = 60 %). `attest.ts` → 23 tokens / 3 articles, `substringOnly` 0; the corpus has it once
 * in the same sense (*oro har ehuneko baten bitartez adierazten*).
 *
 * ⚠ THE PREFIX POSITION IS NOT AN INFERENCE FROM THE CORPUS'S TYPOGRAPHY. The corpus writes `% 32,1` with the
 * SIGN in front ×112, which is suggestive but is a fact about punctuation; the sentence above is a fact about
 * SPEECH, and the two agree. `percentPrefix` is set on that basis.
 */
const PERCENT = "ehuneko";

/**
 * ⚠ THE SQUARE WORD IS A VARIANT CHOICE, NOT A CORRECTNESS ONE, AND BOTH COUNTS ARE RECORDED SO IT CAN BE
 * RE-DECIDED. Basque writes both `kilometro karratu` and `kilometro koadro`, and neither is wrong:
 *
 *     corpus   karratu ×2   ·   koadro ×7      wiki   karratu 21 tok / 15 arts   ·   koadro 52 / 18
 *
 * The token count favours `koadro` 52:21 and the ARTICLE spread barely separates them (18:15), so the count
 * is not decisive. What decides it is the register of the corpus instances: six of `koadro`'s seven are the
 * SAME settlement-stub template repeated across six articles (*biztanle ditu, kilometro koadroko azaleran
 * banatuta*), while `karratu` carries the corpus's only real area figure in running prose — *Europak
 * 10.180.000 kilometro karratu hartzen ditu*. A count inside a repeated template is not evidence about the
 * language, which is this repo's standing rule about counts. `karratu` is also the Euskaltzaindia form.
 * ⚠ `kubiko` (cubed) is thinner still — ×1, `lurrazaleko kilometro kubikoko` — and is declared on that one
 * instance plus its transparency; said here rather than implied.
 */
const SQUARED = "karratu";
const CUBED = "kubiko";

/**
 * The UNIT nouns. `kilometro` ×11 in the corpus and unambiguous (*10.180.000 kilometro karratu*, *204
 * kilometrora*); `metro` ×5 as a whole word (*metroa definitzeko*) against 22 occurrences INSIDE other words
 * (`kilometro`, `diametro`, `parametro`) — counted word-bounded for that reason, because the bare substring
 * is what makes this look better attested than it is. `milimetro` ×2 (*8 milimetroko*). `kilogramo` is ×0 in
 * the corpus and 88 tokens / 20 articles on the wiki, definitional in the SI-prototype article (*Nazioarteko
 * Kilogramo Prototipoa*), which is the right sense and the right register.
 */
const UNITS: Record<string, string[]> = {
    km: ["kilometro"],
    m: ["metro"],
    kg: ["kilogramo"],
    mm: ["milimetro"],
};

/**
 * RATE DENOMINATORS. Basque forms "per X" with the genitive of the time noun rather than a preposition —
 * `kilometro orduko`, `kilometro segundoko` — so `unitPer` is the empty string and the denominator carries
 * the whole construction. `ordu` ×8 and `segundo` ×6 as whole words in the corpus (*23 ordu, 56 minutu eta 4
 * segundo*), and the corpus writes `km/h` ×3 and `km/s` ×2, which is what these exist for.
 * ⚠ DENOMINATORS ONLY, never standalone: declaring `s` in `units` so `m/s` could compose would also make a
 * bare `76s` match — the tier's own documented hazard.
 */
const RATE_DENOMINATORS: Record<string, string> = { h: "orduko", s: "segundoko" };

/**
 * THE DEGREE + SCALE reading, and `sources.ts` reports `[NONE] scale-names` for this language, which is
 * WRONG — its haystack is the corpus and espeak, and the word is on the wiki. `attest.ts --words "gradu
 * Celsius"` → 7 tokens / 6 articles, every one a real temperature with a figure beside it: *tenperaturak
 * normalean 21 eta 27 gradu Celsius (70 eta 80 gradu Fahrenheit) artekoak dira*, *Urteko batez besteko
 * tenperatura 26 gradu Celsius da*, *zortzi gradu Celsius inguruko tenperaturan*. The same sentences supply
 * `gradu Fahrenheit`, so both scales come from one attestation rather than one being inferred from the other.
 * `gradu` alone is ×1 in the corpus and is the ANGULAR degree (*latitude gradu bat*) — the same word, and the
 * reason the bare sign is not claimed here (see the rule).
 */
const DEGREE = "gradu";
const SCALES: Readonly<Record<string, string>> = { C: "Celsius", F: "Fahrenheit" };

/**
 * The DECIMAL separator word, from espeak's `dictsource/eu_list`: `_dpt	_koma`. That is the separator's own
 * name rather than the punctuation mark's (`_,	k'oma` is the mark), which is the distinction the shared
 * sourcing check draws and the reason this is a citation and not a guess.
 * ⚠ IT IS NOT IN THE CORPUS, AND THAT IS EXPECTED RATHER THAN DAMNING: `koma` scores 0 whole-word hits there
 * against 3 occurrences inside other words (`Nikomako`, `komatiten`). A corpus is the weakest evidence there
 * is about how a SYMBOL is spoken — writers type `93,55` and never write how they say it.
 */
const DECIMAL_WORD = "koma";

/**
 * The CASE ENDINGS this rule will attach, exactly the set the corpus writes onto a figure and no more:
 * `a` ×39 (the article), `an` ×124, `ean` ×22, `ko` ×54, `eko` ×14, `koa` ×2, `tik` ×15, `etik` ×2, `ra` ×5,
 * `era` ×2, `en` ×1, `n` ×4. Ordered longest-first so `ean` is tried before `an` and `etik` before `tik`.
 * ⚠ `m` ×3 AND `x` ×2 ARE IN THE SAME TABULATION AND ARE NOT ENDINGS — they are `5m` (a unit) and `2x` (a
 * multiplication), which is why this is a closed list rather than `[a-z]{1,4}`.
 */
const CASE_ENDINGS = ["etik", "eko", "ean", "era", "koa", "tik", "an", "ko", "ra", "en", "a", "n"];

/** The shared symbol tier. Basque POSTPOSES its unit and currency nouns (`10.180.000 kilometro karratu`,
 *  `848.678 euro`, `2.000€`) and PREFIXES the percent word, which the tier expresses directly — so there is
 *  no reason for this layer to own any of it. Currency: `euro` is beside a real figure in the corpus
 *  (*935.366 dolar inguru, 848.678 euro edo 716.224 £*), which also attests `dolar` ×2 whole-word; `libera`
 *  ×1 is the POUND in exactly this slot (*gaur egungo 300 libera esterlinaren parekoa*, "equivalent to 300
 *  pounds sterling"). A Basque noun does not inflect for number after a numeral, so `countForm` is constant. */
const SYMBOLS = makeSymbolNormalizer({
    percent: [PERCENT],
    percentPrefix: true,
    currency: { "€": ["euro"], "£": ["libera"], $: ["dolar"] },
    units: UNITS,
    /**
     * ⚠ A MAGNITUDE WORD SITS BETWEEN THE FIGURE AND THE UNIT, and without declaring it the number is not
     * ADJACENT to the unit, the match fails, and `km` reaches the IPA raw — the tier's own documented hazard.
     * `Asia 44 milioi km² area baino gehiago ditu` is the corpus's case; `399 milioi km-koa` and `55 milioi
     * km-koa` are two more. The words are the engine's own (`basque.jsonc` → `mila`, `milioi`), which is why
     * this is a declaration rather than new vocabulary: `mila milioi` is the Euskaltzaindia-aligned billion
     * that `cardinalWords` already composes, so the three forms here are exactly what the compositor emits.
     */
    magnitudes: ["mila milioi", "milioi", "mila"],
    rateDenominators: RATE_DENOMINATORS,
    unitPer: "",
    exponentWords: { squared: [SQUARED], cubed: [CUBED], position: "after" },
    countForm: () => 0,
});

/**
 * Basque text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling.
 */
export function normalizeBasque(input: string): string {
    let s = input;

    // 0) FOLD U+00BA `º` (MASCULINE ORDINAL INDICATOR) TO U+00B0 `°`. This corpus writes the wrong character
    //    almost as often as the right one — `º` ×12 against `°` ×16 — and the substitution is the one the
    //    playbook already records for Hindi and Italian (`dell'11º`). Two separate failures follow from not
    //    folding, and the second is the one that hides:
    //      · step 2 keys on `°`, so `0,4º C` was not matched and ⟨C⟩ read as /k/ — trap 56, the exact defect
    //        this file's header claims to have closed, reached through the other sign;
    //      · `º` IS `\p{L}` (category Lo), so it also satisfied step 6's trailing letter guard and the decimal
    //        comma beside it stayed a PAUSE. `0,1-0,5º` normalised asymmetrically — first decimal repaired,
    //        second left — which is what made it visible.
    //    ⚠ SAFE HERE BECAUSE BASQUE DOES NOT WRITE ORDINALS THIS WAY: its ordinal is `1.`/`1go`, not `1º`, and
    //    every instance in this corpus is angular or a scale — `58ºI`, `56ºH` (coordinates), `30º`, `7000ºK`.
    //    Folding changes the CHARACTER, not the reading: a bare `°` is still refused (step 2).
    s = s.replace(/\u00BA/gu, "\u00B0");

    // 1) THOUSANDS DE-GROUPING, first, because every later rule needs the figure to be one digit run and the
    //    grouping mark here is the PERIOD — so left alone it is read as a sentence break INSIDE a number:
    //    `42.262.142` came out *berogeita bi . berehun eta hirurogeita bi . ehun eta berogeita bi*, three
    //    numbers and two full stops where the text has one number. ×98 in the retained text.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK and a head of 1–9, so a decimal is never claimed: Basque's decimal
    //    separator is the COMMA (step 6), so a period between digits is unambiguous here in a way it is not
    //    in a point-decimal language — but the guard is kept because the corpus also carries dotted CITATIONS
    //    (`Tristia 4.10.41–54`, `Am 2.18.19-26`) whose components are one and two digits.
    //    ⚠ THE TRAILING GUARD IS `(?!\d)` AND NOT `(?![\d.,])` — playbook trap 58. A clause mark after a
    //    grouped figure is not a continuation of the number, and excluding it declines every figure that ends
    //    a sentence. The de-grouping arms of six other layers had to learn this one character at a time.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?!\d)/gu, (w) => w.replace(/\./gu, ""));
    //    ⚠ AND THE SPACE-GROUPED FORM, ×5 — `40 091 km-koa`, `12 756 km-koa`, `12 730 km-koa`. A wiki that
    //    writes `44.579.000` also writes `40 091`, and both are in this corpus. Three digits per block and a
    //    1–9 head, so an adjacent PAIR of numbers cannot fuse.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:[  ]\d{3})+(?!\d)/gu, (w) => w.replace(/[  ]/gu, ""));

    // 2) THE DEGREE SIGN WITH A SCALE LETTER — `56,7 ° C`, `26 °C`. Both readings come from one attestation
    //    (see SCALES), so neither is inferred from the other.
    //    ⚠ AND THE DEFECT WAS NOT SILENCE. The `°` dropped and ⟨C⟩ reached the g2p as a Basque LETTER, read
    //    /k/ — a plausible phoneme with no basis, which is trap 56 and which no leak class can see. `°F`
    //    would have read /f/ the same way.
    //    ⚠ THE BARE `°` IS DELIBERATELY NOT CLAIMED. `gradu` is attested in this corpus exactly once and it
    //    is the ANGULAR degree (*ekuatoretik latitude gradu bat*), and the corpus's bare-`°` instances are
    //    coordinates and one `0,1-0,5º` (a masculine-ordinal sign, not a degree at all). Claiming the sign
    //    without its scale would put a temperature word on a latitude.
    //    BEFORE the tier, so the scale letter cannot be mistaken for a unit key, and before step 6 so the
    //    operand is still one figure.
    s = s.replace(/(\d)[  ]?°[  ]?([CF])(?![\p{L}\p{M}])/gui, (_m, d: string, k: string) => `${d} ${DEGREE} ${SCALES[k.toUpperCase()]!}`);

    // 3) THE CASE ENDING GLUED TO THE **UNIT**, before the tier, because the tier's trailing guard refuses a
    //    letter after a unit key and therefore declined the whole match — leaving a raw `km` in the IPA. This
    //    is the same morpheme as step 5, attached to the other side of the quantity, which is trap 15's shape:
    //    the layer that handles the suffix on the FIGURE has to be told the unit takes it too.
    //        44.579.000 km²ko eremua   ·   40 091 km-koa   ·   12 756 km-koa   ·   kg-ko   ·   399 milioi km-koa
    //    ⚠ THE HYPHEN OR THE EXPONENT MUST BE PRESENT, and that is the whole guard. Without it a one-letter
    //    key plus a two-letter ending claims ordinary words — `m` + `an` is *man*, `m` + `en` is *men*. Basque
    //    writes the ending on an abbreviation with a hyphen precisely because the boundary is not otherwise
    //    visible, so keying on the writer's own mark costs nothing and is the only thing separating the two.
    //    ⚠ THE BARE ENDING IS ALWAYS RIGHT HERE, WHICH IS WHY THE HYPHEN IS SAFE ON THIS SIDE AND NOT ON THE
    //    FIGURE'S (see step 5). Every noun in `UNITS` is VOWEL-final — kilometro, metro, kilogramo, milimetro
    //    — so Basque supplies no linking vowel and `km-koa` really is *kilometrokoa*. That is a property of
    //    this table rather than of the language, so it is checked here rather than assumed: a consonant-final
    //    unit noun added later would need the same guard step 5 carries.
    //    ⚠ AND THE ENDING GLUES TO THE LAST WORD EMITTED — `km²ko` is *kilometro karratuko*, not
    //    *kilometroko karratu*: the exponent modifier is the head of the phrase and carries the case.
    const unitAlt = Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|");
    const denomAlt = Object.keys(RATE_DENOMINATORS).join("|");
    //    ⚠ THE RATE CARRIES IT TOO, and leaving that out DOUBLED the morpheme rather than stranding it. With
    //    only `UNITS` in the alternation, `km/h-ko` fell through to the tier — whose trailing guard sees the
    //    HYPHEN, not a letter, so it matched happily, emitted `orduko`, and the writer's own `-ko` survived
    //    beside it: *bost kilometro orduko ko*. `km/[hs]-…` is ×3 here (`km/h-ko`, `km/h-koa`, `km/s-ko`), and
    //    the denominator word already ends in the same `-ko` genitive, which is why the doubling reads as a
    //    stutter rather than as an obvious leak. Matched BEFORE the bare-unit arm so `km/h-ko` cannot be
    //    claimed as `km` plus stray text.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${unitAlt})/(${denomAlt})-(${CASE_ENDINGS.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
        (_m, unit: string, denom: string, ending: string) =>
            `${UNITS[unit]![0]!} ${RATE_DENOMINATORS[denom]!.replace(/ko$/u, "")}${ending === "ko" || ending === "koa" ? ending : `ko${ending}`}`,
    );
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${unitAlt})(?:(²|³)-?|-)(${CASE_ENDINGS.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
        (_m, unit: string, exp: string | undefined, ending: string) => {
            const noun = UNITS[unit]![0]!;
            const mod = exp === "²" ? ` ${SQUARED}` : exp === "³" ? ` ${CUBED}` : "";
            return `${noun}${mod}${ending}`;
        },
    );

    // 4) THE SHARED SYMBOL TIER — percent (PREFIXED), currency, units, the `km²`/`km³` exponent and the
    //    `km/h`/`km/s` rates. See the declarations above for each word's source.
    //    ⚠ IT MUST RUN BEFORE STEP 6, and that ordering is the whole reason the decimal step is late. The
    //    tier matches a number ADJACENT to its sign or unit, and Basque's decimal separator is a comma inside
    //    that number: rewriting `93,55` to `93 koma 55` first would leave the tier nothing to match, so
    //    `% 93,55` would lose its sign. Same coupling the playbook records as "units before decimals",
    //    arriving through the percent side.
    s = SYMBOLS(s);

    // 4b) THE NEGATIVE SIGN — a sign attached to an amount, with no left operand.
    //    ⚠ THIS FIXES A SEMANTIC ERROR, NOT A SILENCE. `-89.2 ° C`, `−94,7 ° C` and `(-66 °C)` — the corpus's
    //    record low temperatures — were dropping the sign and reading as POSITIVE. Eighty-nine below zero
    //    became eighty-nine above it: a plausible number, wrong by 178 degrees, and invisible to every gate
    //    because nothing leaks and nothing is unread.
    //    ⚠ THE WORD IS DEFINITIONALLY SOURCED, and this file's header was wrong to say otherwise. It refused
    //    the math signs on the ground that `ken` is ×0 in the CORPUS — true, and beside the point, because
    //    the corpus is not the only tier. eu.wikipedia's article on the signs states both the name and the
    //    use: *"Plus (+) eta minus (−) zeinuak zenbaki positiboak edo negatiboak identifikatzen"* — "the plus
    //    and minus signs identify positive or negative numbers" — and `minus` is 26 tok / 8 arts.
    //    ⚠ SUBTRACTION STAYS REFUSED, and the same article is why the split is principled rather than timid:
    //    it gives the operator a DIFFERENT word — *"10 – 7, hamar KEN zazpi"*. Reading `ken` between two
    //    figures would claim this corpus's 43 `\d-\d` sites, which the header shows are CLASSICAL CITATIONS
    //    (`Am 2.18.19-26`), a reign (`1235-1400`) and a card range — not arithmetic. So the operator is
    //    sourced and still not shipped; only the unambiguous no-left-operand case is.
    //    ⚠ THE LOOKBEHIND SPANS WHITESPACE for exactly that reason: `2.000 – 1.000` has a figure to the left
    //    across a space, so it is a subtraction and is refused. Without the span it would read *minus 1.000*.
    //    ⚠ THE EN DASH IS EXCLUDED AND THE PERIOD IS IN THE LEFT GUARD, both because the first cut read two
    //    things that are not negatives. `nahiko ugaria –700 inguru–` is a PARENTHETICAL pair of en dashes
    //    ("about 700"), and it became *minus 700*; `21. - 29. liburuak` is a spaced ORDINAL RANGE, and it
    //    became *21. minus 29.*. Both are readings, not drops, so nothing downstream would have shown them.
    //    ASCII `-` and U+2212 `−` are what the three real negatives in this corpus are written with, and the
    //    en dash is this corpus's range-and-parenthesis mark — so the character itself does the separating.
    //    ⚠ NO SPACE BETWEEN THE SIGN AND THE FIGURE, and that is the discriminator review found was missing.
    //    Guarding only on what is to the LEFT let the label-value dash through — `Bilbo - 400.000 biztanle`
    //    and `Altuera - 1.234 metro`, the dash-separated shape wiki list prose is full of, have a LETTER to
    //    the left and became *Bilbo minus 400000*. Widening the left lookbehind to letters (the obvious fix)
    //    would have refused `baxuena -89.2 ° C` too, which is the very case this rule exists for.
    //    What actually separates them is the writer's own spacing: all four genuine negatives in this corpus
    //    are written TIGHT (`-89.2`, `−94,7`, `(-66`, `-2,8`), and every dash used as punctuation is spaced.
    s = s.replace(/(?<![\d.]\s{0,3})(?<![\p{L}\p{M}.,])[−-](?=\d)/gu, "minus ");

    // 5) THE CASE ENDING GLUED TO A FIGURE — the largest class in this corpus at ×296, and the one that
    //    produced a stranded consonant cluster: `1980an` read *mila bederatziehun eta laurogei AN*, with the
    //    ending as its own word, and `1980ko` *… laurogei KO*.
    //    ⚠ THE ENDING IS RE-EMITTED, NOT DERIVED — see the header. The writer has already harmonised it to
    //    the spoken form, so attaching it to the LAST WORD of the cardinal is both sufficient and correct;
    //    deriving it would mean choosing between `-an` and `-ean` from the numeral's final segment, which is
    //    the Mongolian problem and is not this language's.
    //    ⚠ AFTER THE TIER, because a figure can carry BOTH a sign and an ending — `% 80ko hezetasunarekin`
    //    ("with 80 % humidity") is in the corpus. The tier claims the `%` and leaves `80ko`; this step then
    //    reads the figure and re-attaches `ko`. Reversed, the tier would find no bare number to match.
    //    ⚠ THE ENDING LIST IS CLOSED (see CASE_ENDINGS): `\d+[a-z]{1,4}` would also claim `5m` and `2x`.
    //    ⚠ AND THE FIGURE MAY CARRY A DECIMAL, which the first cut of this rule did not admit and which fell
    //    between the two steps: `% 93,55a` matched neither — the ending blocked step 5's trailing guard, and
    //    the comma blocked this step's leading one — so it read *…hamahiru , berogeita hamabost A*, a pause
    //    inside the number AND the ending stranded, which is both defects at once. ×8 in the corpus against
    //    ×280 integer ones. The fraction is spelled here rather than left to step 5 for the same reason the
    //    integer is: the ending has to glue to the LAST spoken word, and only this step knows which that is.
    //    ⚠ AND THE ENDING MAY BE HYPHENATED, which the first cut did not admit: Basque writes both `1980an`
    //    and `995-ko`, and step 3 keys on that same hyphen for units. Left out, `995-ko` read *…hamabost KO*
    //    with the ending stranded — the very defect this step exists for, in its other written form. ×3 in
    //    the retained text (`995-ko`, `26-en`, `18-n`), and one of them is the header's own `2.18.19-26-en`.
    const endingAlt = CASE_ENDINGS.join("|");
    s = s.replace(
        new RegExp(`(?<![\\d.,\\p{L}\\p{M}])(\\d+)(?:,(\\d+))?(-?)(${endingAlt})(?![\\p{L}\\p{M}])`, "gu"),
        (whole, digits: string, frac: string | undefined, hyphen: string, ending: string) => {
            const n = Number(digits);
            if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return whole;
            const head = cardinalWords(n);
            if (head === "") return whole;
            // ⚠ A HYPHEN CHANGES THE CONTRACT, AND THIS IS THE ONE PLACE THE HEADER'S CLAIM DOES NOT HOLD.
            // The claim is that the writer has already chosen the allomorph — true of the GLUED form, where
            // `1980an` and `1981ean` are two different spellings. It is NOT true of the hyphenated form: the
            // hyphen exists precisely so the ending can be written BARE and the linking vowel supplied in
            // speech, so `995-ko` is spoken *…hamabostEKO*, not *…hamabostko*, which is not a word.
            // Deriving that vowel is the Mongolian problem this layer was written to avoid, so instead the
            // hyphen is accepted only where the bare ending is provably right — after a VOWEL-final word,
            // where Basque adds nothing. `26-en` → *hogeita seien* is claimed; `995-ko` is declined and left
            // exactly as it was. ×3 in the retained text, and this splits them 1 claimed / 2 declined.
            if (hyphen !== "" && !/[aeiou]$/u.test(head)) return whole;
            return frac === undefined ? `${head}${ending}` : glueFraction(head, frac, ending) ?? whole;
        },
    );

    // 6) THE DECIMAL COMMA → `koma` (espeak `_dpt`; see the declaration). It was reaching
    //    `clausePunctuation` and becoming a PAUSE inside a number: `93,55` read *laurogeita hamahiru ,
    //    berogeita hamabost*, two numbers with a break between them. ×120 in the retained text.
    //    ⚠ LAST OF THE NUMERIC RULES, for the reason step 3 gives.
    //    ⚠ THE GUARDS EXCLUDE A MULTI-COMMA RUN on both sides, which leaves a comma-separated LIST alone, and
    //    a trailing letter, which leaves an ending-carrying figure to step 4. A following clause mark is NOT
    //    excluded (trap 58) — `93,55.` at a sentence end is still a decimal.
    s = s.replace(/(?<![\d,])(\d+),(\d+)(?![\d,\p{L}\p{M}])/gu,
        (_m, a: string, b: string) => `${a} ${DECIMAL_WORD} ${fractionDigits(b)}`);

    return tidy(s);
}

/**
 * ⚠ A LEADING ZERO IN THE FRACTION IS PART OF THE QUANTITY, AND DROPPING IT IS A WRONG NUMBER.
 *
 * The fraction is read as a NUMBER here (`93,55` is *koma berrogeita hamabost*, not five-five), which is the
 * convention this language's corpus supports — but handing `09` to a cardinal compositor yields *bederatzi*,
 * so `5,09` and `5,9` came out BYTE-IDENTICAL. That is trap 56 in its purest form: every word is well-formed
 * Basque, the quantity is wrong by a factor of ten, and no leak class, DROP or referee can see it. `\d,0\d`
 * occurs ×10 in this corpus (`5,09`, `2,09`, `6,02`, `0,08`, `0,03`).
 *
 * Each leading zero is spoken, then the remainder is read as a number — which keeps `0,09` distinct from
 * `0,9` without changing how any fraction lacking a leading zero is read.
 */
const ZERO = "zero";
function fractionDigits(frac: string): string {
    const zeros = /^0*/u.exec(frac)![0].length;
    const rest = frac.slice(zeros);
    const lead = Array.from({ length: zeros }, () => ZERO).join(" ");
    return rest === "" ? lead : lead === "" ? rest : `${lead} ${rest}`;
}
/** The same, as WORDS, for step 5 — where the ending has to glue to the last one. `undefined` declines the
 *  match rather than guessing, and the magnitude bound mirrors the integer head's: without it a 14-digit
 *  fraction was fed to the compositor and came back as twenty-five words. */
function glueFraction(head: string, frac: string, ending: string): string | undefined {
    const zeros = /^0*/u.exec(frac)![0].length;
    const rest = frac.slice(zeros);
    const lead = Array.from({ length: zeros }, () => ZERO);
    if (rest === "") return `${head} ${DECIMAL_WORD} ${[...lead.slice(0, -1), `${ZERO}${ending}`].join(" ")}`;
    const f = Number(rest);
    if (!Number.isSafeInteger(f) || f >= 1e12) return undefined;
    const words = cardinalWords(f);
    if (words === "") return undefined;
    return `${head} ${DECIMAL_WORD} ${[...lead, `${words}${ending}`].join(" ")}`;
}

/** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP is a
 *  corpus-diff defect class; this pass may not feed it. */
function tidy(s: string): string {
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
