import { NOT_LETTER_AFTER } from "../../core/boundaries.ts";
/**
 * Classical Nahuatl (nci) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/nci.jsonc` — a nah.wikipedia dump, 3,135 paragraph segments mined and 585
 * string leaves retained (410 unique). Corpus-wide counts for the classes claimed here, from `mine.ts scan`:
 * `math-sign` 21 · `exponent` 15 · `percent` 11 · `ampersand` 9 · `degree` 8 · `minus` 2 · `currency` 1,
 * plus the RAW-LATIN leaks `kg` ×6 · `km` ×5 · `dm` ×2. This is a SMALL corpus and every instance of every
 * sign below was read individually; the counts in this header are exhaustive, not sampled.
 *
 * ⚠ THIS LAYER DECLARES NO SHARED SYMBOL TIER, AND THAT IS A CONCLUSION RATHER THAN AN OVERSIGHT. Five of
 * the six fields `makeSymbolNormalizer` offers have no sourceable word on this wiki (see the refusals
 * below), and the sixth — `units` — cannot be declared there because the tier matches `(NUM)\s?(unit)` with
 * an OPTIONAL space, which is right for the fleet and wrong here: every genuine metre in this corpus has a
 * space before the `m` (`3 m.`, `10 m`, `25 m`, `12 m`, `16 m`) and every FALSE one does not (`180m Ta`,
 * an isomer label; `9.8m sales` and `15m sales`, English "million" in a discography). Declaring `m` in the
 * tier reads *9.8 metros sales* — a defect that produces a READING and one this layer would have
 * introduced (trap 56). The two unit rules are therefore written locally, with the space required.
 *
 * ⚠ THE PLUS SIGN IS A MORPHEME BOUNDARY, NOT AN OPERATOR, AND IT IS THE CORPUS'S LARGEST SIGN CLASS.
 * TWENTY-TWO of the 24 `+` are inside nah.wikipedia's own NUMERAL articles, which decompose a vigesimal
 * word into its morphemes and then state the digits:
 *
 *     Cēmpōhualomēyi (cēm + pōhual + on + ēyi) ītōcā cē tlapōhualli auh mohcuiloa "23".
 *     Caxtōlonnāhui (caxtōl-li + on- + nāhui) ītōcā cē tlapōhualli auh moihcuiloa "19".
 *     Nāuhpōhualmahtlāctli omēyi (nāuh + pōhual + mahtlāctli + on + ēyi) … "93".
 *
 * The other two are a Spanish chemistry infobox (`Estados de oxidación (óxido) +2`) and a decay-mode
 * column (`0,012% 8,125 h ε β + 0,854`). Not one is arithmetic in Nahuatl prose, so the sign is refused — and reading it would have turned
 * a morphological gloss into *cēm plus pōhual plus on plus ēyi*.
 *
 * ⚠ AND THE DEGREE CONFUSABLE POINTS THE OTHER WAY FROM THE LAST THREE ROUNDS. `°` U+00B0 ×12 is the
 * degree; `º` U+00BA MASCULINE ORDINAL INDICATOR ×3 is a SPANISH ORDINAL — `2º Potencial de ionización`,
 * `2º potencial de ionización`, `3º potencial de ionización`. Hawaiian widened its degree class to a
 * confusable and was right to; widening it here reads *second ionization potential* as *two degrees*. The
 * confusable is present and is deliberately EXCLUDED.
 *
 * ⚠ THE COLON IS A SCRIPTURE REFERENCE FOURTEEN TIMES AND A CLOCK SIX TIMES, AND ARITY SEPARATES THEM
 * PERFECTLY. All four three-part times are clocks (`12:02:50 nicān cāhuitl`, `18:02:50 UTC`,
 * `23:49:17 nicān cāhuitl (UTC-5)`, `13:14:40 nicān cāhuitl (UTC-5)`) and no verse reference has three
 * parts; both two-part clocks carry `hrs` (`4:00 hrs.`, `12:14 hrs`) and no verse reference does. An
 * hour-bounded `H:MM` rule — the fleet standard, and what Hawaiian and Karakalpak both ship — would read
 * `Marcos 8:29`, `Lucas 2:11`, `Lucas 9:20`, `Mateo 1:16`, `Juan 1:41`, `Mateo 1:18`, `Lucas 1:27`,
 * `Tlachiuhtli 1:14`, `Lucas 1:26`, `Lucas 2:1`, `Juan 19:25` and `Tlahtohqueh 18:41` as TIMES OF DAY.
 * Hawaiian escaped this because its wiki writes verses with U+02D0 TRIANGULAR COLON; this one writes them
 * with the same ASCII colon as its clocks.
 *
 * ⚠ THE SEPARATORS SPLIT BY ARTICLE LANGUAGE, AND THE SPACE IS THE ONE THAT MATTERS.
 *
 *     ` ` GROUPING (Nahuatl)  1 000 000 · 5 000 000 · 720 000 · 480 000 · 128 000 · 149 600 000
 *     `,` GROUPING (Nahuatl)  384,400 km · 3,746 km · 37,932,330 km² · 21,860,000,000 km³ · 1,500,000
 *     `.` DECIMAL  (Nahuatl)  1.72% · 96.5% · 99.86% · 45.9 km · 2.5 · 8.2 Mw · 5.8 metro · 4567.9
 *     `,` DECIMAL  (Spanish)  647,096 K · 22,0664MPa · 293,15 K · 0,012% · 8,125 h · 100,1 años
 *     `,` CHAPTER,VERSE       Mt 20,29-34 · Mc 10,46-52 · Lc 18,35-45 · Mt 1,18-2,23  (≈25 instances)
 *
 * The space-grouped figures are the worst-reading class in the corpus, because `720 000` reads today as
 * *seven-hundred-twenty* followed by `ahtle` — numbers.ts's stopgap for a zero Classical Nahuatl has no
 * numeral for. ⚠ AND THE PALEOANTHROPOLOGY ARTICLES GLOSS EVERY ONE OF THEM, which is both what confirms
 * the reading and an independent check on numbers.ts's base-20 ladder:
 *
 *     nāuhpōhualxiquipilli īpan mahtlācxiquipilli (720 000)     4·160 000 + 10·8 000  ✓
 *     mācuīlpōhualxiquipilli īpan cempōhualxiquipilli nō mācuīlxiquipilli (1 000 000)
 *                                                800 000 + 160 000 + 5·8 000          ✓
 *     caxtōllioncenxiquipilli (128 000)                         16·8 000               ✓
 *
 * ⚠ THE COMMA'S THREE-DIGIT TEST COSTS FIVE INSTANCES AND IS STILL RIGHT. There is no orthographic feature
 * separating `647,096 K` (water's critical temperature, 647.096 K, in an imported Spanish infobox) from
 * `384,400 km` (the lunar distance, in Nahuatl prose): both are one-to-three digits, a comma, three digits.
 * The test gets all ten Nahuatl groupings right and misreads the five Spanish decimals whose fractional
 * part happens to be three digits long (`647,096 K`, `643,847 K`, `21,671MPa`, `8,125 h`,
 * `1,602 176 487`). Declining the comma outright would instead misread all ten, `21,860,000,000 km³`
 * included. Recorded in the investigation doc as a residual, not papered over.
 *
 * ⚠ NO PERCENT WORD EXISTS. `porciento`, `porcentaje` and `ciento` are ALL ×0 on nah.wikipedia — and
 * `ciento` at ×0 rules out the two-token Spanish `por ciento` as well, since its head noun would have to
 * appear somewhere. Seventeen `%` in the artifact, nine of them in Nahuatl prose, and nothing to read them
 * with. Same shape as Tashelhit; the tier is not declared at all here, so the sign is simply left visible
 * to the leak gates.
 *
 * ⚠ THE CURRENCY AND THE FRACTIONS ARE SELF-GLOSSED, SO READING THEM WOULD DOUBLE THE WRITER'S OWN WORDS.
 * The corpus's only `$` is `Naman ipatiuh cetzin $40 pesos tlen tomin` — the Spanish noun and the Nahuatl
 * money word `tomin` are both already there. All three `n/m` fractions are glossed the same way, and the
 * gloss shows the idiom: `īnnāhui cē (1/4)`, `īmmahtlāctli oncē cē (1/11)`,
 * `īnōmpōhualli ommahtlāctli cē (1/50)` — ī(n)- before a vowel or n-, ī(m)- before m-. Derivable, and
 * deliberately not implemented, because there is no un-glossed instance to spend it on.
 *
 * ⚠ AND THE AMPERSAND NEVER JOINS TWO NAHUATL WORDS, though the word for it is everywhere. All 18 are
 * either the literal HTML entity `&nbsp;` (×10) or a FOREIGN name — `Queen & David Bowie`, `Hope &
 * Anchor`, `Blank & Jones`, `Jo & Co`, `Schuster & Loeffler`, `Fretz & Wasmuth`, `Ward Lock & Co`. `ihuan`
 * ×514 / `īhuān` ×112 is the conjunction and emitting it would speak Nahuatl inside an English band name.
 * The `&nbsp;` half IS repaired below: it reaches the g2p today as the word *nbsp* and blocks the unit
 * behind it.
 *
 * ⚠ THE MINUS REFUSAL COSTS, AND THE PRICE IS STATED. `-1° C`, `(-120 °C)` and `(-2O°C)` are true
 * negatives in the water and climate articles, and a dropped minus INVERTS them. The candidate word does
 * not survive its examples: `menos` ×21 is entirely inside ONE Spanish grammar table in the
 * Nahuatl-morphology article — "Ni- más el verbo **menos** vocal larga final", the preposition *without*,
 * describing a morphological subtraction — and never stands before a number. `negativo` is ×0.
 *
 * SOURCING — every word emitted is a nah.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/nci.jsonc`. ⚠ The wiki is filed under `nah`, NOT `nci`: the mined artifact's own
 * provenance line says `nci.wikipedia.org`, which does not exist, and `attest.ts` without `--wiki nah`
 * returns a page of false absences.
 */

/** ⚠ NEVER `\b` — Nahuatl carries the macrons `ā ē ī ō ū` and the colonial acutes `á é í ó ú`, all of
 *  which `\b` treats as word boundaries (trap 1/23). `\p{M}` is in the class because the corpus is not
 *  uniformly NFC and a macron may arrive as a combining mark. */
/**
 * Units this layer reads, and the two it refuses.
 *
 * `kilómetros` ×1 ("in ic 149 600 000 kilómetros cah") and `kilometro` ×1 ("itech catqui chicuace
 * kilometro ihuan"); `metros` ×1 ("īxquichica ēyi metros īīxpan in huēyatēncō") and `metro` ×1 ("ce
 * ioctacayo inic 5.8 metro"). The PLURAL is emitted throughout — the corpus has no `1 km` or `1 m` to
 * disagree with, and inventing agreement for a slot that never occurs is not evidence.
 *
 * ⚠ `cm` ×8, `dm` ×2 AND `kg` ×6 ARE LEFT UNREAD: `centímetro`, `centímetros`, `kilogramo`, `kilogramos`
 * and `gramo` are all ×0 on nah.wikipedia. The botany articles are full of `cm` ("30 īhuān 110 cm",
 * "7 cm in diámetro") and there is no noun for them. A gap, kept visible.
 *
 * ⚠ AND `km²` / `km³` ARE DELIBERATELY EXCLUDED by the `²³` in the lookahead: `cuadrado`, `cuadrada`,
 * `cúbico` and `cúbica` are ×0 too, so the two instances (`37,932,330 km²`, `21,860,000,000 km³`, both in
 * the Moon article) would lose their power silently if the unit were read without it.
 */
const UNITS: readonly (readonly [string, string])[] = [
    ["km", "kilómetros"],
    ["m", "metros"],
];

/** Normalize one Classical Nahuatl input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeNahuatl(input: string): string {
    let s = input;

    // 1) ZERO-WIDTH STRIP. U+200B ×15, doubled after `uan ` throughout the machine-translated
    //    modern-Nahuatl articles ("uan ​​eli nopa ompa ueyi tlanemakaketl", "uan ​​moneki kipixtos").
    //    Invisible, so it can only ever be noise; U+FEFF is stripped with it. ⚠ ZWJ/ZWNJ are NOT touched —
    //    they are contrastive in several scripts and this rule has no business generalising.
    s = s.replace(/[​﻿]/gu, "");  // ZWSP, BOM

    // 2) THE `&nbsp;` ENTITY, ×10 AND LITERAL. The dump extractor left it in text, so `45.9&nbsp;km`
    //    reaches the g2p as the word *nbsp* AND hides the `km` from step 8 (`133&nbsp;km`, `12&nbsp;km`,
    //    `57&nbsp;km`, `25&nbsp;°C`, `0&nbsp;°C`, `100&nbsp;°C`, `-120&nbsp;°C`). ⚠ Replaced by a SPACE,
    //    not deleted — it IS a space, and deleting it fuses the figure to its unit (trap 10).
    s = s.replace(/&nbsp;/gu, " ");

    // 3) DE-GROUPING THE SPACE, BY THE THREE-DIGIT TEST — and this is the highest-value rule in the layer,
    //    because a space-grouped figure currently reads as two numerals with the zero stopgap between them:
    //    `720 000` is *seven-hundred-twenty ahtle*. `1 000 000`, `5 000 000`, `480 000`, `128 000`,
    //    `149 600 000`. ⚠ THE WHOLE NUMBER AT ONCE (trap 63) — one join per pass would leave
    //    `1 000000` on the first sweep. ⚠ The trailing guard rejects a DIGIT and nothing else (trap 58),
    //    so a figure at a clause end (`… (480 000) xihuitl`) is not declined by its own bracket.
    //    ⚠ AND THE HEAD GUARD IS WHAT DECLINES A SPACE-GROUPED DECIMAL TAIL: `1,602 176 487(40)` in the
    //    Spanish physics infobox has a comma two characters back, so no start position qualifies.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 4) DE-GROUPING THE COMMA, same test — `384,400 km`, `3,746 km`, `37,932,330 km²`,
    //    `21,860,000,000 km³`, `1,500,000`, `2,600,000`, `222,297`, `100,000`, `18,980`.
    //    ⚠ THE SCRIPTURE CITATIONS ARE DECLINED BY THE TEST ITSELF and need no guard of their own: a
    //    chapter,verse reference has ONE or TWO digits after the comma (`Mt 20,29-34`, `Mc 10,46-52`,
    //    `Lc 3, 23-38`), never three. See the header for the five Spanish decimals this does misread.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));

    // 5) THE DECIMAL DOT, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE — `punto` ×0 and `coma` ×0 on
    //    nah.wikipedia — so the mark is spent rather than spoken; the defect being fixed is the false
    //    SENTENCE BREAK it produces mid-quantity, which the baseline probe showed on `45.9&nbsp;km`
    //    ("oːmpoːwalli ommaːkʷiːlli . tʃikʷnaːwi"). The Punjabi and Karakalpak choice, for the same reason.
    //    ⚠ THE `(?<![\d.])…(?![\d.])` GUARD keeps this off a dotted run of three or more groups; this
    //    corpus has none, but an IP address or a `d.m.Y` date is one dump away and the guard costs nothing.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, "$1 $2");

    // 6) THE CLOCK, GATED ON ARITY AND ON THE MARKER WORD — see the header. The three-part form is a clock
    //    in all four of its instances and no verse reference has three parts, so `h:m:s` is claimed
    //    outright; the two-part form is claimed ONLY before `hrs`, which is what separates `4:00 hrs.` and
    //    `12:14 hrs` from fourteen Gospel citations written with the identical ASCII colon.
    //    The writer supplies the context word, so the figures stay FIGURES and only the colon is spent.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)(?![\d:.,])/gu, "$1 $2 $3");
    //    …and `hrs` is expanded with it, or it reaches the g2p as *ɾs* — nahuatl.ts correctly silences a
    //    word-initial ⟨h⟩, which is right for the language and wrong for this abbreviation. `horas` ×4 on
    //    nah.wikipedia, of which two are the real countable hour ("se billón horas", "500 horas tlen
    //    contenido") and two are a Spanish poetry title and a gloss; `hora` ×3 is two NOVEL TITLES ("La
    //    mala hora", "La hora de todos") and one true hour ("azo ya ipan matlactli hora"). Thin, read, and
    //    in the right slot. ⚠ THE TRAILING DOT IS NOT CONSUMED (trap 10) — `4:00 hrs.` ends a sentence.
    s = s.replace(new RegExp(`(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:.,])(\\s?)hrs${NOT_LETTER_AFTER}`, "gu"),
        "$1 $2$3horas");

    // 7) DEGREES. ⚠ `°` U+00B0 ONLY — `º` U+00BA is the Spanish ordinal in this corpus (see the header) and
    //    adding it "for symmetry" is the one-character generalisation that reads three ionization
    //    potentials as temperatures. `grados` ×1 on nah.wikipedia and ⚠ ITS SOLE EXAMPLE IS A RICHTER
    //    MAGNITUDE — "ōcatca in 8.0 grados īpan octacatl Richter" — not a thermometric degree. It is
    //    nevertheless a measurement-scale degree in Nahuatl-wiki prose in the numeral-then-noun slot, and
    //    it is the word Spanish uses for `°C`, which matters because this wiki's measure nouns ARE Spanish
    //    (`kilómetros`, `metros`, `minutos`, `segundos`, `millones`, `pesos`). Shipped BARE: `celsius`,
    //    `centígrados`, `fahrenheit` and `kelvin` are all ×0, so the scale letter is consumed unread rather
    //    than reaching the IPA as a stray [k] (`17 °C.` reads "… omoːme k ." today).
    //    ⚠ THE SCALE LETTER CLASS IS `C` ALONE, because `°F` is ×0 here — every degree in this corpus is
    //    Celsius (`17 °C`, `0 °C`, `100 °C`, `-1° C`, `-120 °C`) and an unattested `F` arm is a misfire
    //    generator for nothing (trap 9).
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 grados");
    s = s.replace(/(\d)\s?°/gu, "$1 grados ");

    // 8) THE TWO UNITS, WITH THE SPACE REQUIRED — the reason this layer declares no shared tier; see the
    //    header. Every genuine metre in the corpus has the space and every false one does not, and `km`
    //    and `cm` never occur glued to a digit, so the requirement costs nothing there.
    //    ⚠ `/` IS IN THE LOOKAHEAD so `4970 m/s` is declined: it is a RATE, no `s` noun is attested
    //    (`segundo` ×0, `segundos` ×1 but as a duration — "8 minutos īhuān 19 segundos"), and reading the
    //    numerator alone yields *metros s*.
    //    ⚠ AND `²³` ARE IN IT so `km²` and `km³` keep their power visible to the leak gates rather than
    //    losing it silently to a unit with no measure word behind it.
    for (const [abbr, word] of UNITS) {
        s = s.replace(new RegExp(`(\\d)\\s+${abbr}(?![\\p{L}\\p{M}\\d²³/])`, "gu"), `$1 ${word}`);
    }

    // 9) RANGES. ⚠ THE HYPHEN BETWEEN DIGITS IS MOSTLY A CITATION HERE, and the fleet-standard guards are
    //     what decline them: the trailing `(?!\s?-\s?\d)` chain test rejects the ISO dates
    //     (`(1962-10-05)`, `(1964-03-20)`) and the ISBN (`970-07-6492-3`) at their first join, and the
    //     `(?<![\d.,\-/])` head guard rejects their second and third. What is left is the life-and-reign
    //     spans this corpus actually writes — `Itzcōātl (1427-1440)`, `(1867-1934)`, `(1494-1524/1525)`,
    //     `(98-117)`, `1765 - 1815`, `18-22 Febrero`, `266-270 ilhuitl`, `21-35`.
    //     ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: the corpus writes the span in full where
    //     it means it ("momātia ītzalan 30 īhuān 110 cm", "momātia 10 īxquichca 12 m" — *from X to Y*), so
    //     imposing a connective on a bare dash would double a word the writer already chose or not.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and an adjacent slash means a
    //     regnal alternative (`1494-1524/1525`) rather than a span.
    //     ⚠ AND `UTC-5` IS DECLINED BY THE HEAD GUARD needing a DIGIT before the dash — the `C` is a letter.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
