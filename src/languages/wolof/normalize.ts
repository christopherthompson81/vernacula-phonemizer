/**
 * Wolof (wo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA. Called from
 * `WolofPhonemizer.text()` before tokenization.
 *
 * ⚠ THE SHARED SYMBOL TIER IS INVOKED FROM INSIDE THE SEQUENCE (step 4), not wrapped around it, and that is
 * forced from both ends:
 *   · the HTML-entity fold (step 1) has to run BEFORE it, or `km&sup2` never presents a `²` for the exponent
 *     branch to match and `10&nbsp;km` has no number adjacent to its unit;
 *   · DE-GROUPING (step 5) and the DECIMAL spell-out (step 9) have to run AFTER it — the tier's `NUM` matches
 *     `1 219 912` and `43,3` whole, and spelling a decimal out first would leave `43 3 %` with only the `3`
 *     beside the sign.
 * Everything else is ordered inside those two walls.
 *
 * ⚠ WOLOF WRITES BOTH SEPARATORS IN BOTH ROLES, and a third (the space) in one. Measured over the mined
 * artifact's 408 retained segments:
 *
 *     separator + exactly 3 digits   ~43   GROUPING   30.065.000 · 1 219 912 · $150,000 · 700,000 · 2 798
 *                                                     · 14 090 000 · 112.622 · 4.560 kilomet · 35.000 nit
 *     separator + 1–2 digits         ~20   DECIMAL    43,3 % · 2,8 milyoŋ · 15.85 · 4.7 · $2.17 · 9,10 · 5,5
 *     `0` + separator + 3 digits       2   DECIMAL    0.449 (an HDI index) · 0,511 MeV
 *     other 1–2-digit head + 3-digit tail  2  AMBIGUOUS  `1,602 · 10⁻¹⁹` — the electron charge, twice
 *
 * So the grouping arms demand blocks of exactly `\d{3}` AND a head starting 1–9, and the decimal arms take a
 * 1–2 digit tail plus one extra arm for a `0` head (a grouped number never opens with a leading zero, so
 * `0.449` is unambiguous). The two `1,602` are a stated false positive, not an oversight — see step 5.
 *
 * ⚠ TRAP 14/15 DOES NOT ARISE, and that was measured rather than assumed. Wolof is not agglutinative and its
 * numerals do not take a bound case suffix; what does glue to a digit is the ORDINAL (`16eelu`, `9eem`,
 * `184eelu`, ×12), and that already reads — the tokenizer splits it and both halves phonemize
 * (`16eelu xarnu` → *fukː ak ɟuroːm bɛnː ɛːlu xarnu*). The suffix survives, nothing is dropped, and gluing
 * it onto the numeral's last word would be a word-boundary refinement with no reading to repair. Left alone.
 *
 * Deliberately not done, each with the measurement behind it:
 *   · NO BARE-COLON CLOCK RULE, AND NO CLOCK WORD. 33 `\d{1,2}:\d{2}` shapes in the retained text and
 *     **33 of 33 are SCRIPTURE REFERENCES** — `Pe 2:1-3:22`, `Jëf 19:26-27`, `Ge 1:26-30`, `Ex 6:20`,
 *     `suraat 2:30-38`, `1Ki 15:8-24`. A ceb-shaped bare-colon rule would have broken all 33 (playbook
 *     trap 55, the ilo/ceb finding). The `:` reads as a comma pause, which is a defensible reading of a
 *     verse reference. That conclusion stands and is why step 0 is MARKER-keyed rather than shape-keyed.
 *     ⚠ THE PREMISE "ZERO CLOCKS" DID NOT SURVIVE (#1111). It is true of the mined artifact and false of
 *     Wolof: FLEURS `wo_sn` carries 9 distinct sentences with a `d:dd`, **8 of them a time of day** (the
 *     ninth is a Giant Slalom result, `bu toll ci 4:41.30, 2:11`). ⚠ AND #1111 SAID "8 of 8 … 0
 *     non-clocks" — re-counted here at 9 and 8, because the sports line is a counter-example and the
 *     marker guard has to be shown to decline it, which it does: it carries no marker and neither does
 *     any verse reference.
 *   · NO INITIALISMS (~60 retained, 792 corpus-wide: ASF ×5, AOF ×4, OMS ×3, MPLA ×3, IFAN ×2). The seam
 *     exists and I checked it (trap 16): `core/initialisms.ts` needs a `letterName` table, espeak ships no
 *     Wolof at all, and no in-repo source carries one. Wiring it without one is a NO-OP. A sourcing gap.
 *   · NO ROMAN RULE. `wo` is not in `ROMAN_NATIVE` (registry.ts — only en/fr are), so `III`/`XVIII` are
 *     already digits by the time `text()` runs.
 *   · NO `=` READING. 20 in the retained text: 3 physics equations, ~9 lexical/translation glosses
 *     (`baziira = gisug xol`, `vin= akusativo`), 2 wiki heading markers (`==Melo wi==`, `Death forever=`).
 *     `yem ak` ×4/4 is attested as "is equal to" — and its clearest hit is the corpus's own equation
 *     sentence, *"moo yem ak e = 1,602 189 2 ∙ 10-19 C"*, i.e. the REDUNDANT case where the words are
 *     already written. A rule would fire mostly on glosses, in a register nothing attests, and on markup
 *     where any word is wrong. REFUSED WHOLE, so the reading is byte-identical to today's (trap 53's `ak`
 *     shape, never its Igbo half-reading shape).
 *   · NO `·` / `∙` MULTIPLICATION and NO BARE EXPONENT. `1,602 · 10⁻¹⁹` ×3. No Wolof "times" word and no
 *     "to the power of" phrase is attested in the corpus, on wo.wikipedia or in the kaikki referee, so
 *     `multiply` and `bareExponent` are both omitted. ⚠ THE SECOND HALF OF THAT SENTENCE USED TO SAY THE
 *     MARKS "STAY WHERE THE RAWMARK GATE CAN SEE THEM", and for the exponent that was never true — the
 *     tokenizer ate it (#1041). Wolof's instances are NEGATIVE exponents, which the tier's new digit
 *     fallback also declines (no sign word to spend), so this corpus is unchanged either way.
 *   · NO MINUS. The 2 signs the scan reports are a LIST BULLET (`Doom bi: -Daa tàcc -5 ba 7,5i sàntimet`,
 *     a botanical description) and the spaced exponent inside `10 -19`. The corpus contains no negative
 *     number; same conclusion as the Burmese run, reached from the instances.
 *   · NO FRACTION RULE. 10 `N/N` shapes and 8 are DATES (`31/12/2007`, `26/06/1945`, `21/8/1969`). The two
 *     genuine ones are `2/7` and `2/3` — and the corpus GLOSSES the second, *"ñaari ñatteeli cer (2/3)"*,
 *     which shows the idiom is numerator-cardinal + denominator-ORDINAL + `cer`. Two instances is not
 *     enough to build a denominator series on, and `sources.ts` reports `[NONE] fraction-series`.
 *   · NO ERA EXPANSION, only de-dotting — see step 3.
 *   · NO CFA KEY. `FCFA` is ABSENT from wo.wikipedia and `CFA` ×8/4 never follows a number — every hit is a
 *     bare code in a noun phrase (*zone CFA*, *xaalis CFA*, *zone franc CFA*). `frank` ×7/4 is a real Wolof
 *     currency noun (*130 milyoŋ yu Frank*), but there is no SIGN in either corpus to key it to.
 *   · NO `€`. Zero euro signs. `yuro` ×0; `euro` ×3/3 with one substring-only, and the two real hits are the
 *     same duplicated sentence (*plaat bu nekk 5 euro*). One sentence is a lead, not a finding.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";

/**
 * The shared symbol tier.
 *
 * ⚠ EVERY WORD BELOW IS ATTESTED, and where the biggest count was the WRONG word that is recorded beside it.
 * espeak does not ship Wolof, so the sources are this language's mined corpus, wo.wikipedia via
 * `attest.ts` (cached in `tools/corpus/attest/wo.jsonc`) and the kaikki referee.
 *
 * ⚠ NO `CountForms` HAS MORE THAN ONE ENTRY. Wolof marks plurality on the noun's class prefix/linker, not by
 * a suffix after a numeral: the corpus writes `29 kilomet`, `100 meetar`, `8 sàntimet`, `50 ba 100 dolaar` —
 * the bare stem after every count, singular or plural. One citation form is the whole agreement story.
 */
const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⟨%⟩ → `ci téeméer`, literally "in a hundred", POSTPOSED (the tier's default).
     *
     * ⚠ THE CITATION IS THE SIGN AND ITS READING IN ONE SENTENCE, which is as good as this gets:
     * wo.wikipedia writes *"lu ci ëpp ci **50% (juroom-fukk ci téeméer)** ba **70% (juroom-ñeent-fukk ci
     * téeméer)** ci ñi muy dal ci dee lañuy mujjee"* — the glyph, then the words, twice. The mined corpus has
     * it independently (*"lu tolloog juróom-fukk ci téeméer"*) and a third article writes
     * *"juróom-ñaar-fukk ak juróom-ñeent ci téeméer ak ñaar-fukk"*. ×4 tokens over 3 articles, 0
     * substring-only. `téeméer` is also this engine's own word for 100 (`numbers.ts`), so the phrase is
     * sourced arithmetic in the Fula `e teemedere` sense as well as being directly attested.
     *
     * 64 instances in the retained corpus, every one of them silently dropped before this.
     */
    percent: ["ci téeméer"],
    /**
     * ⟨$⟩ → `dolaar`. ×9 tokens over 9 articles, and glossed against BOTH the sign and the ISO code:
     * *diggante 50 ba 100 dolaar (USD)* · *15,41 dolaar (USD)* · *565i tamñareet ciy dolaar u Amrig* · and in
     * the mined corpus *$12 miliyaar ciy dolaar*, which is trap 12's redundant shape.
     *
     * ⚠ `US$` IS ITS OWN KEY because the tier's currency pattern is letter-bounded on the left, so a bare
     * `$` cannot match inside `US$`. The corpus writes both (`US$ 65 milyoŋ`, `US$5`, `$375`, `$150,000`),
     * and without the compound key the `US$` instances kept a dropped sign while `US` read as a word.
     * ⚠ THE KEYS ARE QUOTED DELIBERATELY: `review.ts`'s sourcing check reads currency entries with
     * `/"([^"]+)"\s*:/`, so an unquoted key makes that gate go BLIND rather than pass.
     */
    currency: { "US$": ["dolaar"], "$": ["dolaar"] },
    /**
     * The magnitude words, in the spellings this corpus actually writes — wo.wikipedia is not orthographically
     * settled here and uses six spellings of "million" and three of "billion". Sorted longest-first by the
     * tier itself, so `miliyoŋ` cannot be shadowed by `milyoŋ`.
     *
     * ⚠ DECLARED FOR BOTH CONSUMERS ("one declaration, two consumers"). The currency path needs it for
     * `$12 miliyaar ciy dolaar` and `US$ 65 milyoŋ`; the UNIT path needs it for `2,51 milyioŋ ciy km²` and
     * `44 milyoŋ ciy kilomet` — a magnitude plus its connective standing between the number and the unit,
     * which without this field breaks the adjacency and leaves `km` raw with the `²` dropped.
     * `junni` (10³) and `junni-junni` (10⁶, literally "thousand-thousand") are the INHERITED magnitudes —
     * `9,4 junni km²`, and `13,9 junni-junni km²` on the wiki (×3/2). `tamñareet` is the corpus's own word in
     * *565i tamñareet ciy dolaar u Amrig*.
     */
    magnitudes: [
        "junni-junni", "junni", "miliyaar", "milyaar", "bilyoŋ",
        "miliyoŋ", "milyioŋ", "milyoŋ", "milioŋ", "milyong", "miliari", "tamñareet",
    ],
    /**
     * The word joining a magnitude to the noun it counts. Wolof uses the preposition `ci` with its
     * `y`-linker: *$12 miliyaar **ciy** dolaar* · *565i tamñareet **ciy** dolaar* · *2,51 milyioŋ **ciy** km²*
     * · *30 milyoŋ **ciy** kilomet yu kaare*. Emitted only when a magnitude was matched, so a bare `$375` is
     * unaffected — and it is also what lets the tier's "already said it" guard see `miliyaar ciy dolaar` and
     * stay quiet instead of reading *12 dolaar miliyaar ciy dolaar*.
     */
    magnitudeConnective: "ciy",
    /**
     * ⚠ TWO SI KEYS ARE REFUSED, AND BOTH REFUSALS ARE ABOUT THE KEY RATHER THAN THE WORD.
     *
     * `g` — `sources.ts` reports *"the corpus writes g×38 … after a number — source the unit words"*, and
     * the gram word IS sourced (`garaam` ×3/3: *11,6 garaam ci wurus*, *ñaari téemeer ak juróomi garaam*).
     * But there are **50 digit-adjacent `g` in the retained text and not one is a gram** — every single one
     * is the ERA MARKER: `Ci 27 g.K. la juddu`, `atum 1967 g.`, `atum 1392 gg`, `1794 -1796 g.j`. Declaring
     * it would read fifty dates as a weight. Trap 2, arriving through a tool that cannot know.
     *
     * `m` — the metre word is sourced too (`meetar` ×55/20: *100 meetar*, *17 meetar ak yaatuwaayu 2
     * meetar*), and Wolof writes metres as that WORD, never as the symbol. Digit-adjacent bare `m` is ×1 in
     * the whole retained corpus and it is `2012m`, the `miladi` (Gregorian) year marker in an Islamic date.
     * 0 true metres against 1 false positive: the standing one-letter-key trap (46) with a new collider.
     *
     * `kg` — `kilogaraam` ×1/1 (*àgg ba 1,5i kilogaraam*) is a lead rather than a finding on its own, and it
     * is taken because it is the productive `kilo-` prefix (already carrying `kilomet` ×50) on the solidly
     * attested `garaam`, sitting in exactly this slot. ×1 in the corpus (`9,10 · 10−31 kg`, the electron
     * mass), where `kg` currently reaches the IPA raw.
     *
     * `mm` — ⚠ ITS DEFECT PRODUCED A READING, NOT A LEAK, which is why no gate saw it: this engine's
     * CONSONANT GEMINATION rule claims ⟨mm⟩, so `150mm ci at` read *…fukː **mː** ci at* — a plausible Wolof
     * geminate where a millimetre belongs. Trap 56 through a new door (nya's ⟨cm⟩→KILOMETRES was the
     * letter-collision version). `milimet` ×6/5 is a LOW count and a properly sourced one — five independent
     * articles, in the slot, and in the same RAINFALL sense as all four corpus instances (`200 ba 700
     * milimet cib taw` against `150mm ci at`). Trap 25's amendment: a small count is grounds to source
     * harder, not to leave a wrong reading standing.
     */
    units: {
        km: ["kilomet"], // ×50/20 — and glossed against the mile: *29 kilomet (18 mi)*, *32 kilomet (20 mi)*
        cm: ["sàntimet"], // ×43/20 — *40 ba 60 sàntimet*, *8 sàntimet*. ×0 in this corpus; see trap 8.
        mm: ["milimet"], // ×6/5 — *10 ba 15i milimet*, *500 milimet ci taw*
        kg: ["kilogaraam"], // ×1/1 — see above
    },
    /**
     * ⟨²⟩ → `kaare`, POSTPOSED to the unit noun, which is what every attestation writes: *54 000 000 **km
     * kaare*** · *44 milyoŋi **kilomet yu kaare*** · *17 milyoŋi **kilomet kaare*** · ***meetar kaare*** ·
     * *112.622 **yu kaare***. ×24 tokens over 13 articles. The mined corpus writes the one-⟨a⟩ spelling in
     * *44 milyoŋ kilometri kare*; `kaare` is the majority form and the one wo.wikipedia uses in the slot.
     *
     * ⚠ `cubed` IS OMITTED AND THE COST IS STATED. `kubik` is ×0 on wo.wikipedia and no other candidate is
     * attested, so there is nothing to declare. Since `squared` IS declared the tier's exponent branch is
     * live, and an undeclared `cubed` makes it re-emit the power: `1 km³` would read *kilomet³*, leaving the
     * superscript visible to RAWMARK. That is the honest failure and it is unreachable from this corpus —
     * `m³`/`km³` and the ASCII `km3` are all ×0 — but it is trap 53's territory and worth writing down.
     */
    exponentWords: { squared: ["kaare"], position: "after" },
    /**
     * ⟨&⟩ → `ak`, this language's ordinary conjunction and the same word `numbers.ts` uses to join magnitude
     * slots (*fukk **ak** benn* = 11). Nothing to source: it is among the commonest tokens in the corpus.
     *
     * ⚠ THE ENTITY FOLD IN STEP 1 IS WHAT MAKES THIS SAFE, and it is why the tier is invoked from inside the
     * sequence rather than wrapped around it. Of the 9 ampersands in the retained text only 2 are
     * conjunctions (`R&B`, `"Santo Antão - Paisagem & Melodia"`); the other 7 are entity references —
     * `&nbsp;` ×3, `&sup2` ×3, `&alpha` ×1 — and the tier would read every one of them as "ak" plus a
     * fragment. Same finding as nya's, at a worse ratio (7:2 against 6:14).
     *
     * ⚠ NO `unitPer`, `multiply`, `bareExponent`, `percentPrefix`, `currencyPrefix` or `unitPrefix`. Wolof
     * postposes every measure noun (`29 kilomet`, `15,41 dolaar`, `juroom-fukk ci téeméer`), which is the
     * tier's default; and the corpus's single `rate` instance is `MeV/c²`, which is neither a declarable
     * numerator nor a declarable denominator.
     */
    ampersand: "ak",
});

/**
 * The degree noun — and it is trap 37 in its sharpest form. `attest.ts` reports `aj` ×80 over 20 articles,
 * and **every one of those is the HAJJ**: *AJ MÀKKA*, *faratay aj*, *jëfi aj ji*, *ajkat yi*. The DEGREE
 * sense exists only in the COLLOCATION, and the mined corpus carries it three times as a parenthetical gloss
 * beside the sign itself — `60° (60 aj)`, `0° (tus aj)`, `12°8(fukk ak ñaari aj juroom-ñett)`. The last of
 * those settles POSITION as well as sense: `12°8` is read *fukk ak ñaar **aj** juroom-ñett*, the word
 * standing BETWEEN the two operands. 80 hits of the wrong sense against 3 of the right one; a bare token
 * count would have read every coordinate as a pilgrimage.
 */
const DEGREE = "aj";

/** The span joiner. ×15 digit-flanked in the retained corpus and in exactly this slot, both bare and inside
 *  the `diggante X ba Y` frame: *la ko dale ca 1854 ba 1861*, *Mu nguuru ci Yude 48 ba 66 g.K.*, *ci diggante
 *  1979 ba 1989*, *ci 9eem ba 12eem xarnu*, *-5 ba 7,5i sàntimet*, *40 ba 60 sàntimet*. It is an INFIX taking
 *  both operands — the part-of-speech check that Fula's `hakkunde` failed. */
const SPAN = "ba";

/**
 * HTML entities this corpus contains that `core/markup.ts` does not already decode — and the reason it does
 * not is that its `ENTITY` pattern REQUIRES the closing semicolon
 * (`/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/`), while wo.wikipedia writes `km&sup2` without one, ×3:
 *
 *     "km&sup2"   → km sup ɲaːr     the entity survives as a word plus the NUMBER two
 *     "km&sup2;"  → km              decoded upstream
 *
 * ⚠ THIS IS A CORE SHAPE, NOT A WOLOF ONE, and it is measured before being worked around locally: grepping
 * all 161 mined artifacts for a semicolon-less named entity that `markup.ts` otherwise knows gives **8
 * occurrences in 3 languages** — `wo &sup2 ×3`, `pnb &nbsp ×3`, `ee &nbsp ×2`. Bounded and small, so it is
 * reported to the backlog rather than fixed in one language's branch; the fold here is idempotent with the
 * upstream one, so it costs nothing when the semicolon IS present.
 *
 * `&alpha` ×1 is deliberately NOT decoded — `core/markup.ts` records, with the measurement, that a lone
 * Greek letter is silently deleted in 186 of 188 engines, so decoding it would swap a spoken *alpha* for a
 * dropped character. The `&` is spent instead, which is what stops step 4 reading it as the conjunction.
 */
const ENTITY: Readonly<Record<string, string>> = {
    "&sup2": "²", "&sup3": "³", "&nbsp": " ", "&alpha": "alpha",
};
/**
 * ⚠ THE LOOKUP FALLS BACK TO THE MATCH, AND THE MISS BRANCH IS REACHABLE (#1122). The pattern carries `i`
 * AND `u`, so JS's Unicode simple case folding applies — and it maps U+017F LONG S onto `s`. `&ſup2` and
 * `&nbſp` therefore MATCH while the computed key keeps the long s and is not in this table, so the `!` that
 * used to be here asserted non-null on `undefined` and `String.replace` stringified it: `km&ſup2` read
 * *kmundɛfinɛd*, the word "undefined" spoken aloud in Wolof.
 * ⚠ NOT HYPOTHETICAL INPUT. Long s is what OCR'd and historic-orthography text carries, and this tree
 * already ships it — `csharp/goldens/nci.tsv` has `Caſtellana` and `Confeſsionario` in 16th-century book
 * titles. ⚠ AND THE FALLBACK IS THE MATCH, NOT THE EMPTY STRING: a layer that does not recognise something
 * should change nothing, so the text passes through and the `&` reads as this language's conjunction
 * exactly as any other bare `&` does — rather than the characters being silently deleted.
 */

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `85` in
 *  `15.85` as a NUMBER would say *juróom ñett fukk ak juróom* — "eighty-five" — which is a different
 *  quantity from "point eight five". No separator word is emitted; see `saidAfterNear` and the header. */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/**
 * Is `word` written as a whole token within ~45 characters AFTER this match? The redundancy guard for `aj`
 * (trap 12: a text that writes both the sign and its word must say it ONCE).
 *
 * ⚠ AFTER-ONLY, WHERE CHICHEWA NEEDED BOTH SIDES, and that is a measurement rather than a simplification.
 * All four redundant instances here put the gloss AFTER the sign — `60° (60 aj)`, `0° (tus aj)`,
 * `12°8(fukk ak ñaari aj juroom-ñett)` — so a before-arm would buy nothing and would over-suppress: in
 * *"12°8(fukk ak ñaari aj juroom-ñett) ak 16°41"* the SECOND coordinate has an `aj` 20 characters to its
 * left and no gloss of its own, and it is the one instance that most needs the word emitted.
 * ⚠ WHOLE-TOKEN, because `aj` is a substring of `ajiin` and `ajkat`, which are the pilgrimage words.
 */
function saidAfter(full: string, end: number, word: string): boolean {
    return new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, "u").test(full.slice(end, end + 45));
}

/** Normalize one Wolof input string. Steps are ORDER-DEPENDENT; each states its coupling. */
/**
 * A CLOCK'S COLON LOSES ITS PAUSE — but ONLY when a day-part or timezone MARKER follows (#1111).
 *
 * ⚠ THE MARKER IS THE WHOLE RULE, because Wolof is the language where a bare-colon rule is provably wrong.
 * The mined artifact's 33 `\d{1,2}:\d{2}` are 33 SCRIPTURE REFERENCES (`Ge 1:26-30`, `1Ki 15:8-24`) where
 * the comma pause is a defensible reading, and FLEURS `wo_sn` adds a SPORTS TIME (`bu toll ci 4:41.30,
 * 2:11`). Keyed on the marker instead: **4 fixed, 0 claimed** — no verse reference in either corpus carries
 * one, and neither does the race time.
 * ⚠ IT EMITS NO WORD. No Wolof hour noun is sourced here, so the rule spends the colon on a space and
 * stops; the reading gains nothing but the loss of a phrase break inside one time expression.
 * ⚠ THE MARKER LIST IS EXACTLY WHAT IS ATTESTED — `ci suba` ("in the morning") ×2, `ci ngoon` ("in the
 * evening"), `GMT`. Widening it to am/pm would be guessing at a shape this corpus does not write.
 */
// space, NBSP
const CLOCK_MARKED =
    /(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?=[ \u00a0]*(?:ci[ \u00a0]+(?:suba|ngoon)|GMT)(?![\p{L}\p{M}]))/giu;  // space, NBSP

export function normalizeWolof(input: string): string {
    let s = input;

    // 0) A MARKED clock loses the colon's clause pause — see CLOCK_MARKED. First, so every numeric step
    //    below sees one digit run rather than two.
    s = rewrite(s, CLOCK_MARKED, "$1 $2");

    // 1) NFC, THE SEMICOLON-LESS HTML ENTITIES, AND FORMAT CHARACTERS — before anything looks for a number,
    //    a sign or an ampersand. `&sup2` ×3 is the load-bearing one: it sits in the EXPONENT slot
    //    (`74.900.000 km&sup2`), so until it is a real `²` the tier sees a bare `km`, the square is lost
    //    twice over (sign and word), and the leftover "sup2" reads as a word plus the number two.
    //    ⚠ `&amp;` IS UNFOLDED FIRST or a doubly-escaped entity survives as the word "amp" plus a semicolon.
    //    ⚠ SEMICOLON OPTIONAL, and idempotent with core/markup.ts, which already handles the `;` forms.
    //    ⚠ THE FORMAT-CHARACTER STRIP IS NOT COSMETIC: the artifact's `zero-width` cell is ×5, and a
    //    zero-width character INSIDE a word splits it into two tokens — silent damage of the same class as a
    //    dropped letter.
    // ⚠ EVERY ARM ON THE SEAM. These were chained native `.replace` calls on the PIPELINE STRING, and
    // the format-character strip is what desynced the tracker — it deleted the corpus's zero-widths
    // without reporting them, so every later `rewrite` poisoned for it (#1179).
    s = rewrite(rewrite(rewrite(renormalize(s, "NFC"), /&amp;/giu, "&"),
        /&(?:sup2|sup3|nbsp|alpha);?/giu, (e: string) => ENTITY[`&${e.slice(1).replace(";", "").toLowerCase()}`] ?? e),
        /\p{Cf}/gu, "");

    // 2) DEGREES → `aj`, BEFORE the tier (which does not read `°` at all) and before de-grouping, whose
    //    space arm must not see `3° 40'P` as a grouped number.
    //    ⚠ EVERY ° IN THIS CORPUS IS A COORDINATE OR AN ANGLE — 24 of them, and not one a temperature.
    //    `sources.ts` says `[NONE] scale-names` independently, so no Celsius or Fahrenheit word is invented
    //    and no scale arm exists; `°C`/`°F` are ×0 here.
    //    The two-operand arm comes FIRST because `12°8` must not be claimed by the bare arm, which would
    //    leave the `8` as a separate number.
    //    ⚠ THE BARE ARM REFUSES A GLUED LETTER, AND THE REVIEW PROBE IS WHAT FOUND IT. `20 °C` is ×0 in this
    //    corpus, but `review.ts` probes the adversarial neighbour (trap 8) and the first version read it as
    //    *ɲaːr fukː **aɟc*** — the scale letter FUSED into the degree word, one token, which is worse than the
    //    dropped ° it replaced. With no Celsius or Fahrenheit name to emit there is no whole reading
    //    available, so the whole match is refused and `20 °C` reads exactly as it did before (trap 53's `ak`
    //    shape). The guard is a glued letter specifically: `0° walla`, `33° réew` and `1° P` all put a SPACE
    //    between the sign and the following word and are still claimed.
    //    ⚠ ONE KNOWN FALSE POSITIVE, recorded rather than guarded away: `di 33° réew ci réyaay ci àdduna bi`
    //    ("it is the 33rd country by size") uses `°` as the Romance ORDINAL INDICATOR, and reads *33 aj réew*.
    //    That is 1 against the 8 genuine bare degrees, and the two populations are not separable by what
    //    follows — `0° walla 20°`, a real pair of degrees in a thermal-coefficient sentence, is also followed
    //    by a lowercase word. The trade is stated instead of being hidden behind a word list.
    const degree = (n: string, off: number, len: number, full: string): string =>
        saidAfter(full, off + len, DEGREE) ? n : `${n} ${DEGREE}`;
    s = rewrite(s, /(?<![\p{L}\p{M}])(\d+)[ \u00a0]?°[ \u00a0]?(?=\d)/gu,  // space, NBSP
        (w, n: string, off: number, full: string) => `${degree(n, off, w.length, full)} `);
    s = rewrite(s, /(?<![\p{L}\p{M}])(\d+)[ \u00a0]?[°º](?![\d\p{L}\p{M}])/gu,  // space, NBSP
        (w, n: string, off: number, full: string) => degree(n, off, w.length, full));

    // 3) THE DOTTED ERA AND HONORIFIC MARKERS — de-dotted, NOT expanded. ~46 in the retained text:
    //    `g.K.` ×23 and `j.K.` ×8 (the Christian era, after/before), `g.j` ×4 and `g.g` ×1 (the Hijri era),
    //    `j.m` ×4 and `j.y.m` ×3 (the eulogy after the Prophet's name), `t.s` ×3 (an epithet of Allah).
    //    Each interior dot was a SENTENCE BREAK in the middle of a clause: `1967 g.K.` read *…ɡ . k .*
    //    ⚠ NO EXPANSION IS INVENTED. The corpus does gloss the shape once — `3500 n.j.g (njëkk judd gu
    //    yonnant Yalla Isaa)` — but a definitional gloss of an abbreviation is the WRONG REGISTER for what a
    //    reader says in `atum 1967 g.`, which is the trap that put `धन` into Hindi and that nya's era note
    //    records. Taking the dots out is the whole fix; the letters read as letters, exactly as they did.
    //    ⚠ EVERY ELEMENT MUST BE A SINGLE LETTER, which is what keeps this off ordinary prose and off a
    //    domain name: in `wo.wikipedia` the `o` is preceded by `w`, so the lookbehind rejects it.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or `…atum 1967 g.` loses its sentence
    //    break — the same three-way test nya's dotted-capital rule uses, told apart by what follows.
    s = rewrite(s, /(?<![\p{L}\p{M}.])[a-z](?:\.[a-zA-Z]){1,3}\.?(?![\p{L}\p{M}])/gu, (run, off: number, full: string) => {
        const letters = [...run.replace(/\./gu, "")].join(" ");
        const rest = full.slice(off + run.length);
        return rest === "" || /^[ \u00a0]*$/u.test(rest) || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;  // space, NBSP
    });

    // 4) THE SHARED SYMBOL TIER — %, currency, units, the exponent and `&`. AFTER step 1 (it needs a real
    //    `²` and a real space) and BEFORE steps 5 and 9 (it needs `1 219 912` and `43,3` as single operands).
    //    It is invoked here rather than wrapped around the whole pass so that the entity fold can precede it;
    //    see the `ampersand` note in SYMBOLS.
    s = SYMBOLS(s);

    // 5) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping COMMA reads as a clause pause
    //    and a grouping PERIOD as a full stop, so `$150,000` came out *téeméer ak juróom fukk , TUS* — "a
    //    hundred fifty, zero" — and `30.065.000 km²` broke one number into three sentences.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK AND A HEAD STARTING 1–9 — see the header's table. The leading-digit
    //    guard is what keeps the genuine 3-place decimals `0.449` (an HDI index) and `0,511 MeV` out of this
    //    rule, since a grouped number never opens with a zero; step 9's third arm then claims them.
    //    ⚠ ONE KNOWN FALSE POSITIVE, stated: `1,602 · 10⁻¹⁹` (the electron charge, ×2) is a 3-place decimal
    //    with a 1–9 head, so it de-groups to 1602. Nothing in the shape separates it from `4.560 kilomet`,
    //    `6.000 xarekat`, `35.000 nit`, `23,800 daw-làqu` and `20,000 ca ñoom`, which are all genuine
    //    groupings — 6 against 2, and both readings of `1,602` were wrong before (it was a clause pause).
    //    ⚠ THE SPACE ARM'S TRAILING GUARD IS `(?![\d])` ONLY. `1,602 189 2` — the same constant written with
    //    spaced digit groups — is rejected by the LEADING guard instead, because `602` is preceded by a comma.
    s = rewrite(s, /(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = rewrite(s, /(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = rewrite(s, /(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 6) RANGES → `ba`. 21 ascending digit-flanked spans in the retained text once verse references are
    //    excluded: `1906-2001`, `1960-1980`, `1500-1888`, `1884-1885`, `1740 -1786`, `1265 - 1321`, `10-20`.
    //    AFTER step 5, so a grouped endpoint is already one digit run.
    //    ⚠ THE `:` IS IN THE LEADING AND TRAILING GUARDS, and that is what makes the rule safe at all: this
    //    corpus's dominant colon shape is SCRIPTURE (`Jëf 19:26-27`, `Pe 2:1-3:22`, `1Ki 15:8-24`), where the
    //    left operand is preceded by a colon and the right is followed by one. Without it the rule would
    //    claim verse spans as measurements.
    //    ⚠ ASCENDING ONLY, measured: 21 ascending against 1 non-ascending (`1–1`). Nearly free here, and it
    //    is what stops a score or a model designation being read as a span.
    //    ⚠ U+2212 MINUS IS NOT IN THE CLASS. `9,10 · 10−31 kg` writes its negative exponent with the real
    //    minus sign, and admitting it would read the electron mass as "10 ba 31".
    //    ⚠ AND NOT AFTER A MULTIPLICATION DOT, for the ASCII twin of the same sentence: `1,602 189 2 ∙ 10 -19`
    //    would otherwise become `10 ba 19`. One instance, and it is a confidently wrong reading replacing a
    //    silent one.
    //    ⚠ THE TRAILING GUARD DOES NOT REJECT A `.`, AND THAT IS DELIBERATE. A SENTENCE PERIOD IS NOT PART OF
    //    A NUMBER, so `(?![…\.…])` declined every range that ENDS A CLAUSE — `Ge 1:26-30; 2:4-8; 15-20.` came
    //    back as two juxtaposed cardinals with nothing between them, the very defect this rule exists to fix.
    //    Reported by `review.ts`'s `clause-final` check. And the dot is not protecting an ordinal reading: a
    //    fleet-wide measurement compared the numeral WORD for `5` against `5.` in all 47 languages whose range
    //    rule declined a clause-final dot and found ZERO ordinal readings, Wolof's included — the language
    //    writes its own ordinal as `-eel(u)`/`-eem` (step 7), never as a trailing period.
    //    ⚠ THE `,` NOW DECLINES ONLY WHEN A DIGIT FOLLOWS IT, which is a third option this note used to miss.
    //    It framed the choice as reject-every-comma versus accept-every-comma, and took the first because
    //    Wolof writes the DECIMAL COMMA (`43,3 %`, `2,8 milyoŋ`, `9,10`, `5,5` — see the header's separator
    //    census) — paying 3 segments, all clause commas after a year span, to keep `N-N,N` out. But a comma
    //    only makes a decimal when a DIGIT follows it: `,\d` in the lookahead refuses `1939-1940,5` exactly
    //    as the old class did, while `atum 1939–1940,` is read. The trade was real and is no longer necessary.
    //    ⚠ THE DOT IS DELIBERATELY NOT IN THAT ALTERNATION. The old class did not carry one either, so a
    //    clause-final dot was already admitted (`15-20.` → *15 ba 20 .*) and adding `\.\d` here would be a
    //    second, unrelated change smuggled into a comma fix.
    //    Same shape as the clause-final period two paragraphs up, and the same trap (58) one step further on.
    s = rewrite(s, /(?<![-:\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-:\d\p{L}\p{M}]|,\d)/gu,  // space, NBSP
        (whole, a: string, b: string, off: number, full: string) =>
            Number(a) < Number(b) && !/[·∙×][ \u00a0]*$/u.test(full.slice(Math.max(0, off - 3), off))  // space, NBSP
                ? `${a} ${SPAN} ${b}`
                : whole);

    // 7) THE ENGLISH ORDINAL SUFFIX (`20th`, `3rd`, `2nd`, `1st`). Wolof writes its own ordinal as `-eel(u)`
    //    or `-eem` (`16eelu xarnu`, `9eem`, `184eelu`), so a Latin suffix on a digit here is always foreign
    //    orthography — it occurs inside the English and Portuguese passages this wiki carries — and it was
    //    reaching the phoneme stream as a bare [tʰ]. Stripping it is the whole fix; no Wolof ordinal
    //    morphology is invented, because the language already writes its own out. Case-insensitive (trap 7).
    s = rewrite(s, /(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 8) A LONE `+` IS LEFT UNREAD, deliberately. `sources.ts` reports the sign does not occur in this
    //    corpus at all, and the playbook's fleet-wide finding is that the UTC-offset plus is the one
    //    contentful plus and the one nothing attests. Recorded rather than guessed.

    // 9) DECIMALS, LAST of the numeric rules — steps 2 to 6 all need their number intact, and the tier at
    //    step 4 needs the digit adjacent to its sign (`43,3 %` must reach it whole, or only the `3` is
    //    beside the percent). The separator was reaching `clausePunctuation` and becoming a SENTENCE BREAK or
    //    a comma pause inside a number.
    //    NO SEPARATOR WORD IS EMITTED. `sources.ts` reports `[NONE] decimal-point`; the only candidate,
    //    `tomb` ×33/19, is the geometric POINT (*ab tomb*, *ñaari tomb yi* — the two poles, *ci bépp tomb boo
    //    jël ci biir watatukaay bi*) and nothing puts it between two digit runs. A sense-based refusal, so it
    //    stands on the corpus alone. The point is not spoken — and it was not spoken before either; it was a
    //    full stop in the middle of a number.
    //    ⚠ BOTH SEPARATORS, restricted to a 1–2 digit tail, plus a THIRD ARM for a `0` head at any tail
    //    length — the constructive half of step 5's leading-digit guard, and what claims `0.449` and `0,511`.
    //    ⚠ THE `:` IS IN THE LEADING GUARD AND `,` IN THE TRAILING ONE, or the scripture lists claim the
    //    rule: `Jëf 2:9; 19:10,22,26,27` and `1Ko 15:22,45` are verse enumerations, not decimals.
    s = rewrite(s, /(?<![\d.,:])0[.,](\d+)(?![\d.,])/gu, (_m, f: string) => spell("0", f));
    s = rewrite(s, /(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d.,])/gu, (_m, i: string, f: string) => spell(i, f));
    s = rewrite(s, /(?<![\d.,:])(\d+),(\d{1,2})(?![\d.,])/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` ak `, `${n} aj`) doubles a space that was already there and can leave one at
    // an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return rewrite(rewrite(s, /[^\S\n]{2,}/gu, " "), /^[^\S\n]+|[^\S\n]+$/gu, "");
}
