import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
/**
 * Aragonese (an) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/an.jsonc` — an.wikipedia dump, 255,887 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 90,280 · `year` 89,305 · `decimals` 24,548 ·
 * `abbrev` 17,018 · `grouped` 15,257 · `roman` 15,137 · `exponent` 13,092 · `units` 12,366 ·
 * `rate` 10,578 · `ordinal-latin` 7,655 · `ranges` 6,148 · `signs` 3,452 · `fractions` 2,081 ·
 * `dotted` 1,807 · `percent` 1,255 · `clock` 889 · `arithmetic` 678 · `signed-number` 342 ·
 * `degrees` 178 · `era-marker` 101 · `currency` 85.
 *
 * ⚠ THIS ROUND IS A TEST OF TRAP 55, and it half-passed. Asturian — the closest sibling in the fleet — was
 * treated two rounds earlier, so each of its findings was carried over as a HYPOTHESIS and re-measured
 * here. Four held and two did not:
 *
 *     HELD    the DOT groups and the COMMA decimates      `30.689 km2` · `8.443.713` vs `21,9°` · `55,4%`
 *     HELD    …and the DOT also DECIMATES under 3 digits  `10.92 °C` · `4.76 °C` · `4.74 mil millons`
 *     HELD    the SPACE groups as well                    `450 295 km²` · `30 278 km2` · `1 000 000 mm`
 *     HELD    `°` and `º` are SWAPPED, in both directions  see below
 *     REFUTED the currency is POSTPOSED                   both orders here, and the PREFIX is commoner
 *     ABSENT  the Roman numeral is a MONTH                no `24-X-1793` date form in this language
 *
 * ⚠ THE DEGREE SIGN AND THE MASCULINE ORDINAL INDICATOR ARE SWAPPED, AND THIS CORPUS PROVES IT IN ONE
 * SENTENCE. `°` U+00B0 and `º` U+00BA render near-identically at text size, and Aragonese uses each for
 * the other's job — here inside a single clause about the same thermometer:
 *
 *     "…baixan d'os -10º. A temperatura meyana d'o mes de chinero ye de 3º y la de agosto de 21,9°…"
 *
 * `º` is also the degree at `40º en bels puestos`, and `°` is the ORDINAL at "Suecia ye o **57° país** mas
 * gran d'o mundo". ⚠ So neither codepoint identifies the sense and the DISCRIMINATOR IS WHAT FOLLOWS,
 * written as an ALLOW-LIST rather than a guess. The one ordinal is left unread rather than told to say
 * *cincuanta i siet graus país* — a defect that produces a READING is the worst kind (trap 56).
 *
 * ⚠ AND THE CORPUS DEFINES ITS OWN NOTATION, THREE TIMES OVER. This is the richest self-glossing artifact
 * the sweep has met, and every emitted word below is taken from one of them rather than from a dictionary:
 *
 *     the degree sign  "O grau Celsius u grau centigrado, representau como °C, ye una unidat de temperatura"
 *     the metric units "1 000 000 mm - un millón de milimetros. 100 000 cm - cient mil centimetros.
 *                       1000 m - mil metros. 100 dam - cient decametros. 10 hm - diez hectometros."
 *     the coordinate   "Graus:Menutos:Segundos (en anglés Degree Minute Second, DMS) eixemplo 41:20:00"
 *     the decimal mark "0,1 mam - zero coma un…"
 *
 * ⚠ THE COLON IS AN ATHLETICS STOPWATCH. Of the eleven colon-between-digits instances in the retained text
 * only TWO are times of day (`A las 17:07`, `a las 04:35 UTC`); six are RACE TIMES in minutes:seconds
 * .hundredths — `3:40.96 min`, `7:50.71 min`, `13:47.77 min`, `28:39.11 min`, `8:09.09 min`, `3:34.91` —
 * and one is the DMS coordinate glossed above. The Faroese finding, recurring in an unrelated family. What
 * settles it is the TRAILING GUARD: a stopwatch carries `.dd` after the second field and a clock does not.
 *
 * ⚠ `>` IS A SOUND-CHANGE ARROW, and every instance is one etymology table in the aragonés article —
 * `PONTE > puent`, `FERRU > fierro`, `FOLIA > fuella`, `SPEC'LU > espiello`, `IUVEN > choven`. Shan's `>`
 * was the same; gd's was a LaTeX fragment, tk's a typo for ⟨ş⟩, la's a real comparison, oc's a taxonomic
 * rank chain. ZERO comparisons here, so the sign is refused and registered. The other math signs are the
 * same story: `+` is a PHONOLOGICAL ENVIRONMENT in "g(+e), g(+i)" and a pagination in `XVIII+1022 pp.`,
 * and `±` is an approximate geological date (`fa ±415 - ±360 m.a.`).
 *
 * ⚠ AND THE SLASH IS ALMOST NEVER A FRACTION. Of eleven retained instances only three are (`2/3`, `1/10`,
 * `1/72`); the rest are LEGAL CITATIONS (`Lei 10/2009`, `Decreto 208/1993`, `Lei Organica 4/1979`), an
 * issue number (`Fuellas, 16/93`), a sports season (`temporada 2004/2005`), a date (`30/10/1977`) and the
 * population rate. Reading a statute number as a fraction is trap 56 again; refused and registered.
 *
 * ⚠ THERE IS NO CENTURY POLICY, for the third Romance round running. `sieglo XX`/`XII`/`IX`/`VIII`/`XV`/
 * `XIX` are frequent and the corpus never spells one out, so the shared cardinal pass reads *sieglo vinte*.
 * Recorded, not guessed — same as Asturian and Occitan.
 *
 * SOURCING — every word emitted is an an.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/an.jsonc`.
 */

/** ⚠ NEVER `\b` — Aragonese carries `á é í ó ú ñ ü ï` and the interpunct, which `\b` treats as
 *  boundaries (trap 1/23). */
/**
 * ⚠ THE ALLOW-LISTED CONTINUATION IS THE WHOLE OF THE DEGREE RULE — see the header. The sign reads as a
 * degree only before one of the shapes that actually follows a degree in this corpus: a scale letter, a
 * prime-bearing minute, a compass letter, an end of clause or an opening bracket, or one of the
 * connectives the corpus writes after a bare degree (`de`, `y`, `en`). The lone ordinal (`57° país`)
 * qualifies under none of them and falls through unread.
 *
 * ⚠ THE COMPASS SET IS `NSEU`, NOT `NSEW` — Aragonese west is *ueste*, and the corpus writes `11°U y 12°E`
 * for Algeria's longitudes. Copying the Asturian/English `W` would have missed every western longitude in
 * the language and matched a letter it does not use for the purpose.
 */
const DEGREE_TAIL = "(?:\\s?[CF]|\\s?[NSEU](?![\\p{L}\\p{M}])|\\s?\\d+\\s?[′']"
    + "|\\s*(?:de|y|en)(?![\\p{L}\\p{M}])|\\s*[.,;:)(»]|\\s*$)";

/** Normalize one Aragonese input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeAragonese(input: string): string {
    let s = input;

    // 1) SEPARATORS. ⚠ THREE CONVENTIONS IN ONE CORPUS, inherited from Ibero-Romance and confirmed rather
    //    than assumed (see the header): the DOT groups when exactly three digits follow and decimates
    //    otherwise, the COMMA always decimates, and the SPACE groups.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, not one join per pass (trap 63), and the trailing guard
    //    rejects a DIGIT and nothing else, or every clause-final figure is declined (trap 58).
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));
    //    ⚠ AND WHAT IS LEFT CARRYING A DOT IS A DECIMAL, folded onto the comma the engine's number branch
    //    reads. Doing this before the grouping pass would turn every grouped figure into a decimal.
    s = s.replace(/(?<!\d)(\d+)\.(\d+)(?!\d)/gu, "$1,$2");

    // 2) THE ERA MARKER. `a. C.` is *antes de Cristo*, written with the spaces this corpus uses — "dende
    //    arredol d'o 12.500 a. C.", "dende o 3900 a. C.", "(490 a. C.?)", "(467 a. C.)". It was reaching
    //    the g2p letter-by-letter with two false clause pauses. `d. C.` is its counterpart.
    //    ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.`, "gu"), "antes de Cristo"],
        [new RegExp(`${NOT_LETTER_BEFORE}d\\s?\\.\\s?C\\s?\\.`, "gu"), "dimpués de Cristo"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 3) THE ABBREVIATIONS the corpus writes around its figures. `lum.` is *lumero*, the Aragonese word,
    //    and the corpus uses it in its own journal citations ("Fuellas … lum. 160"); `nº` is the Spanish
    //    abbreviation of the same thing, and this artifact carries BOTH ("Rolde · Revista de Cultura
    //    Aragonesa, nº 132"). ⚠ `nº` IS WHY THE ORDINAL INDICATOR CANNOT BE FOLDED ONTO THE DEGREE SIGN
    //    globally: here U+00BA is neither a degree nor an ordinal but part of a word.
    //    ⚠ EACH ABBREVIATION EXPANDS TO THE WORD IT ABBREVIATES, not to the commoner synonym: `lum.` is
    //    `lumero` (×2, thin but unambiguous — it is what the letters stand for) and `nº` is `numero`
    //    (×97). Collapsing them onto one word would be a guess dressed as a count.
    //    ⚠ AND `hab.` LOSES ITS DOT RATHER THAN GAINING A WORD, because the shared tier reads `hab/km²` as
    //    a rate and cannot see through the abbreviation point — `413 hab./km²` and `43,5 hab/km²` are the
    //    same measurement written two ways, and this is what makes them one shape.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}n\\s?[º°]\\s?\\.?(?=\\s*\\d)`, "gu"), "numero ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}lum\\s?\\.(?=\\s*\\d)`, "gu"), "lumero");
    s = s.replace(/(\d)\s?hab\s?\.\s?(?=\/)/gu, "$1 hab");
    //    ⚠ AND `m.a.` IS CLAIMED BECAUSE THE TIER WOULD OTHERWISE READ ITS `m` AS METRES. "En o Devoniano
    //    (fa ±415 - ±360 m.a.) se formó la penya calsinera" — *millons d'anyadas*, the geological unit,
    //    and the corpus writes the phrase out elsewhere ("1,5/1,8 millons d'anyadas d'antigüidat"). Left
    //    alone, `360 m.a.` composes as *trecientos sisanta metros* — a defect that produces a READING
    //    (trap 56), and one this layer would have INTRODUCED rather than inherited.
    s = s.replace(new RegExp(`(\\d)\\s?m\\s?\\.\\s?a\\s?\\.`, "gu"), "$1 millons d'anyadas");

    // 4) THE CLOCK, and ⚠ THE GUARD IS THE RULE. The colon is clause punctuation in aragonese.ts, so
    //    `A las 17:07` read as *deθisjete , sjete* — a phrase break inside a time. But six of the eleven
    //    colon instances in this corpus are ATHLETICS TIMES (`3:40.96 min`, `28:39.11 min`) and one is a
    //    degrees:minutes:seconds coordinate, so what the rule must do is decline them: a trailing `.dd`
    //    or a second colon is what a stopwatch has and a clock has not. The figures are left as figures.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])/gu, "$1 $2");

    // 5) SIGNS, before the range rule spends the hyphen. `-10º`, `-19°`, `-37,8 °C`, `−0,5 °C` — the
    //    climate prose, and the minus INVERTS rather than pausing. `menos` is the corpus's own word.
    //    ⚠ AND THE GUARD IS THE ATHLETICS LIST AGAIN. The same articles that supply the stopwatch times
    //    write them as `EVENT - TIME`: "3.000 metros obstaclos - 8:09.09 min", "1.500 metros lisos -
    //    3:40.96 min". That hyphen is a list separator, and without the lookahead this rule reads six
    //    national records as NEGATIVE times — a reading the status quo did not produce, so the layer would
    //    be introducing it (trap 56). A figure whose digits run into a colon is a time, not a signed
    //    quantity; `-10º` and `-218.3°C` carry no colon and are untouched.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(\d(?!\d*:))/gu, "$1menos $2");

    // 6) DEGREES. ⚠ BOTH CODEPOINTS, ONE ALLOW-LIST — see DEGREE_TAIL and the header. `grau` is the
    //    singular the corpus glosses ("O grau Celsius … representau como °C") and `graus` the plural it
    //    writes ("a -40 graus, a escala Fahrenheit…").
    //    ⚠ `Graus` IS ALSO A TOWN IN ARAGON and outscores the measure word on the wiki — but unlike
    //    Occitan's `gras`/`graus` pair it is the SAME WORD PHONETICALLY, so the homograph costs nothing
    //    here. Worth stating because the identical-looking check went the other way one round ago.
    s = s.replace(/(\d)\s?[°º]\s?([CF])(?![\p{L}\p{M}])/gui,
        (_m, d: string, scale: string) => `${d} graus ${scale.toUpperCase() === "C" ? "Celsius" : "Fahrenheit"}`);
    s = s.replace(/(\d)\s?[°º]\s?(\d+)\s?[′']/gu, "$1 graus $2 menutos ");
    //    …and the compass letter is spelled, because a bare `N` after a degree is unambiguous and the
    //    alternative is the letter name. `19° y 37°N`, `12° N`, `11°U y 12°E`, `60° de latitut sud`.
    const COMPASS: Readonly<Record<string, string>> = { N: "norte", S: "sud", E: "este", U: "ueste" };
    s = s.replace(/(\d)\s?[°º]\s?([NSEU])(?![\p{L}\p{M}])/gu,
        (_m, d: string, c: string) => `${d} graus ${COMPASS[c]}`);
    s = s.replace(new RegExp(`(\\d)\\s?[°º](?=${DEGREE_TAIL})`, "gu"), "$1 graus ");

    // 7) RANGES. The dash was dropped and the endpoints fused — `1961-1990` read as one run, `28–37` as
    //    one number. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Aragonese writes `entre X y
    //    Y` and the corpus does so in full where it means it ("entre os 21 y os 28°C", "entre os 10.000 y
    //    os 30.000 parladors"), so imposing the connective on a bare dash would double a word the writer
    //    already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), a chain of three or more
    //    hyphen-joined groups is an identifier rather than a span, and an adjacent SLASH means the pair is
    //    part of a citation (`Lei 10/2009`) rather than a range.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
