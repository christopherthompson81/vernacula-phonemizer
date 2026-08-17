/**
 * Umbundu (umb) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. FLEURS `umb_ao`, 2,111 rows → **1,493 unique utterances** (column 3, cased and punctuated).
 * There is no mined artifact for this language and `mine.ts scan` cannot run; every count below was taken
 * over that deduplicated text. Corpus-wide counts for the classes claimed here: `.` thousands groups 20
 * (25 dotted-number instances) · `,` decimals 12 · clock colons 11 · hyphen ranges 9 · `–`/` - ` clause
 * dashes 12 · `%` 6 · `º` 7 · Greek-iota misspellings 10 · `NNhNN` 2 · sports times 3 · `&` 1 · `$` 1 ·
 * `²` 1 · `½`/`¾` 1 each. `°` `+` `−` `×` `÷` `±` `=` `<` `>` are **×0 — none of them occurs at all**.
 *
 * ⚠ THIS LANGUAGE HAS NO SOURCE BUT ITS OWN CORPUS, AND THAT IS A MEASUREMENT, NOT AN ASSUMPTION.
 * `sources.ts --lang umb` reports **"espeak does not ship this language at all"** — no `umb_list`, hence no
 * letter names, no `_dpt` decimal word, no fraction series. `referee-eval.ts umb` throws
 * `no referee config for "umb"`. And **umb.wikipedia.org does not exist**: `attest.ts` refuses to probe it,
 * and `curl` gets no connection at all (`umb:000`) from the same network on which
 * incubator.wikimedia.org answers 200 — Umbundu is still in Incubator. So the wiki route is not merely at
 * trap 51's floor, it is absent, and the haystack for every word this file emits is 1,493 sentences. Where
 * that haystack is silent the sign is left UNREAD rather than guessed (registered in
 * `tools/normalization/defects.ts`).
 *
 * ⚠ THE CONTACT LANGUAGE IS PORTUGUESE AND IT OWNS THE MEASURE SLOT — the question the Nahuatl and Mixe
 * rounds forced, asked here and answered with instances. Every measure word this corpus writes beside a
 * figure is Portuguese or a Portuguese loan:
 *
 *     100 pés (38,48m)            105 milhas k’ekukutu (165 Km/h)      1.000 libras (454 kg)
 *     6 polegada lyelupuko        36 la 24 mm negativo                 4 ale kolo 5 porcento
 *
 * …and the notation is Portuguese too: the DOT groups thousands and the COMMA decimates (`3.850 km²`,
 * `163,52 km/h`), the era is `a. C.` / `d. C.`, and the clock is written `20h30` / `15h00`.
 * ⚠ BUT THE SYNTAX IS NOT PORTUGUESE AND THE ORDER IS NOT SWAHILI'S EITHER. `unitPrefix`/`currencyPrefix`
 * exist because "a measure noun heads its phrase in Bantu" (Swahili *kilomita 19,500*). Umbundu's closest
 * treated sibling would predict that, and **this corpus refutes it in every instance**: the figure comes
 * first and the noun follows — `120-160 metelo`, `22.500 vyondolale`, `5 kwenda 100 k’olondolale`,
 * `4 ale kolo 5 porcento`, `17.500 milya k’ekukutu`. The tier's DEFAULT postposition is correct here and
 * both prefix flags are deliberately unset (trap 55: the sibling is a hypothesis).
 *
 * ⚠ TEN WORDS ARE SPELLED WITH A GREEK IOTA, AND THE ENGINE DELETED THE LETTER AND SPLIT THE WORD. This is
 * trap 61 in mirror image — Chuvash types the Latin twins of its Cyrillic letters; Umbundu types the GREEK
 * twin ⟨ῖ⟩ U+1FD6 (iota with perispomeni) of its own ⟨ĩ⟩ U+0129, which renders identically:
 *
 *     lyakulῖhiwa → *ljakul hiwa*      okupitῖla ×2 (beside okupitĩla ×3)      akwῖ ×2 (beside akwĩ ×12)
 *     ekulῖho · catῖla · lavῖ · uvῖ · lyukulῖhiso
 *
 * `akwĩ` is TEN, one of the commonest words in the language. The token pattern in `umbundu.ts` is bounded to
 * `\p{Script=Latin}`, correctly and deliberately, so a Greek letter ENDS the word: the run is split in two
 * and the letter itself vanishes. ⚠ NO GATE SEES IT — nothing is dropped that DROPPABLE hunts, no raw mark
 * survives, and the halves are still well-formed Umbundu syllables, so the output reads as words (trap 56).
 * Folding is one row, costs no vocabulary, and is measured at zero risk: ⟨ῖ⟩ is the ONLY non-Latin letter in
 * the entire corpus (full census: ã 678 · ĩ 369 · ñ 300 · õ 296 · ẽ 278 · … · ῖ 10, and nothing else above
 * U+007F that is not Latin).
 *
 * ⚠ THE DEGREE SIGN IS ABSENT AND `º` IS THREE DIFFERENT THINGS. `°` U+00B0 is ×0 — `sources.ts` says
 * "no ° in the corpus" and it is right. What the corpus writes is `º` U+00BA MASCULINE ORDINAL INDICATOR,
 * ×7, and porting a `°`-shaped degree rule onto it would be wrong four times in seven:
 *
 *     DEGREE ×3   35ºW  ·  90º F (32ºc)                    ORDINAL ×2   10º yaswalãli (the Italian 10th
 *     NUMERO ×1   cosmonauta Nº 11                                      Army) · 37º ofeka linene (Turkey,
 *     JUNK  ×1    ya mamako 240º km                                     the world's 37th largest country)
 *
 * ⚠ AND THE SCALE LETTER IS LOWERCASE IN THE ONE INSTANCE THAT NAMES BOTH SCALES: `90º F (32ºc)`. A
 * `[CF]` class matches the Fahrenheit and misses the Celsius; `[CFcf]` would then also claim the ⟨c⟩ of any
 * word. It is moot here — **no degree word is sourceable** (`grau` ×0, `selsiyu` ×0, and there is no wiki to
 * ask) — so `º` is left entirely alone and recorded rather than claimed. It is not in the `degree` DROPPABLE
 * class either, so no gate is being silenced by this.
 *
 * ⚠ THE EN-DASH IS A CLAUSE DASH ELEVEN TIMES IN TWELVE, NEVER A MINUS AND ESSENTIALLY NEVER A RANGE — the
 * Karakalpak em-dash finding, reproduced in a different mark and a different sense. `– ` sets off an
 * apposition in running prose (`ocimunga c’ofeka oyo lika unyãli wavo`, `wakisika omãla okufeta elivulu`),
 * and the sole numeric instance `lyasoka 26 – 00` is a SCORE. Every real range in this corpus is written
 * with a TIGHT HYPHEN and no spaces — `35-40 mph`, `56-64km/h`, `120-160 metelo`, `2-3 km`, `1644-1912`,
 * `1000-1300 d. C.`, `5-3`, `7-2`, `10:00-11:00` — so the two marks are separated by SPACING, not by shape,
 * and the range rule below takes only the tight one.
 *
 * ⚠ AND `kilo` ×27 IS THE Fula-`tere` TRAP INSIDE THE CORPUS ITSELF. It looks like a ready-made kilogram
 * word with a healthy count; **not one instance is a unit**. Twenty-five are inside `efetikilo`/`kefetikilo`
 * ("the beginning"), and the two whole-token hits are the postposition `kilo lyomunda` / `kilo lyeve` ("on
 * top of the hill/the earth"). `Metro` ×4 is the same shape one word over — it is the SUBWAY and a
 * newspaper (`ndeci o MetroPlus lakãlu anene vyo Metro`), never the metre.
 *
 * SOURCING — every word emitted below is a token of this corpus whose examples were read:
 *   `porcento` ×1  "Ocitangi ko co ku lilongisa … yikala kolo 4 ale kolo 5 **porcento** kolomala vosi yo
 *                   america" — the percent slot exactly, after the figure.
 *   `metelo`  ×1   "Luno wakwatele 120-160 **metelo** k’okulepa lyo-kombustivel" — FLEURS's universal
 *                   cubic-metre sentence (trap 45). ⚠ AND IT SUPPLIES THE NOUN AND NOT THE MODIFIER: this
 *                   translation drops "cubic" exactly as `as`, `bg` and `xh` mangle the same sentence, so
 *                   the metre is sourced and the CUBE WORD IS NOT.
 *   `kwenda`  ×733 the ordinary coordinator, "and", used between nouns throughout.
 *
 * REFUSED, each with its count and its price (trap 53):
 *   `km` ×14, `mm` ×6, `kg` ×6, `mph` ×3, `km/h` ×22 — **no word exists in any source**. `kilometelo`,
 *      `quilometro`, `kilograma`, `milimetelo` are all ×0 and `kilo` is the trap above. These reach the IPA
 *      as raw letter clusters today (`km`, `mm`, `kɡ`, `ᵐph`) and still will; the refusal is neutral
 *      because nothing in this layer touches them, and it is REFUSED WHOLE rather than half (ak's rule):
 *      declaring `m` alone cannot bite `km` because the tier's leading guard rejects a key with a letter
 *      before it, so `km²` reads exactly as it did rather than becoming a confidently wrong LENGTH.
 *   `k’ekukutu` IS attested ×3 as "per hour" and the hour noun `(a/e)kukutu` ×12 — but `unitPer` needs BOTH
 *      units declared and the numerator `km` has no word, so the rate declines whole (trap 54, the `si`
 *      case). Recorded because the denominator is the half that is normally missing, and here it is the half
 *      that exists.
 *   `²` ×1 (`3.850 km²`), `½`/`¾` ×1 each (`unene wa 29¾ / 24½`, a dimension in inches with the `×` written
 *      as a slash) — no square word, no fraction series (`sources.ts`: "fraction occurs, no series to
 *      compose from"). Registered as an accepted silence.
 *   `$` ×1, and it is `AUD$` — a composite mark (trap 64), one instance, and the currency DROP class does
 *      NOT report on this corpus. `ondolale` ×5 / `ondolare` ×1 IS attested in monetary amounts
 *      (`22.500 vyondolale`, `5 kwenda 100 k’olondolale`), so the word is not the blocker. The ORDER is:
 *      this corpus writes the magnitude before the currency (`14,7 k’olohulukãyi vyovita yondolale`), and a
 *      postposed tier reading of `AUD$45 k’olohulukãyi` puts the noun in the wrong slot — id's `US$` defect,
 *      which the DROP gate scores as clean. One instance is not worth that, and the word is recorded here so
 *      the next round can start from it rather than re-source it.
 *   `a. C.` ×2 / `d. C.` ×1 (Portuguese *antes/depois de Cristo*) and `E. U. A.` ×5 — real defects, each
 *      producing false sentence breaks, and both blocked on vocabulary this corpus does not carry (no era
 *      phrase, no letter-name table since espeak has no umb). Backlog, not silenced.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared SYMBOL tier. THREE declarations, no more — see the header for what each rests on and what was
 * refused. ⚠ NO `exponentWords`, NO `unitPer`, NO `magnitudes`, and NEITHER PREFIX FLAG.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["porcento"],
    // ⚠ ONE-LETTER KEY, AND ITS SAFETY IS THE ORDERING BELOW. The tier's `NOT_VERSION` guard works by seeing
    // the DOT (traps 39/46), and this corpus writes `802.11n` — so the tier MUST run before step 4 spends
    // the thousands dot. It does; that is why step 3 sits where it does and not after de-grouping.
    // Measured: every digit-adjacent `m` in this corpus is a genuine metre — `(38,48m)` ×2 and `3,50 m` ×1 —
    // and `35mm`, `600Mbit/s`, `133 m/s` are declined by the tier's own trailing letter guard or, for the
    // rate, by the undeclared denominator.
    units: { m: ["metelo"] },
    ampersand: "kwenda",
});

/** Normalize one Umbundu input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeUmbundu(input: string): string {
    let s = input;

    // 1) THE GREEK IOTA, FOLDED TO THE LATIN NASAL VOWEL IT IS DRAWN AS — see the header. ⚠ FIRST, because
    //    it is a SPELLING repair and every later step's word boundary (`(?![\p{L}\p{M}])`) would otherwise
    //    treat the stray letter as a boundary too. Both cases, though only the lowercase occurs (×10);
    //    ⟨Ĩ⟩ U+0128 occurs ×2 already correctly spelled, so the capital row is symmetry, not a measured fix.
    s = s.replace(/ῖ/gu, "ĩ").replace(/Ῑ/gu, "Ĩ");

    // 2) THE SHARED SYMBOL TIER, ordered as the Karakalpak and Punjabi layers order it: its own numeral
    //    pattern reads `3.850` and `163,52` as ONE token, and steps 3 and 4 split precisely those. It also
    //    has to see the version dot of `802.11n` while it still exists (see the `units` comment above).
    s = SYMBOLS(s);

    // 3) DE-GROUPING THE THOUSANDS DOT. Portuguese convention, and the three-digit test is unanimous here:
    //    every dot inside a figure has EXACTLY three digits after it (`1.400`, `40.000`, `3.850 km²`,
    //    `17.500 milya`, `6.387 km`, `5.000.000`), while every COMMA has one or two (step 4). Untouched, the
    //    dot reached `clausePunctuation` and read as a FULL STOP inside the number: `3.850 km²` was
    //    *tatu . ovita ecelãla lakwi atãlo* — "three. eight hundred fifty" — a false sentence break in the
    //    middle of a quantity, which is the worst defect in this corpus and which no leak class can see.
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63), or `5.000.000` joins its first group and then re-anchors
    //    inside the remainder and reads as two numerals.
    //    ⚠ THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58): `(?![\d.,])` would decline every
    //    clause-final figure, and this corpus ends sentences on one (`… lyomanu.`, `… cikale 55.000.`).
    //    ⚠ AND THE EXACT `\d{3}` IS WHAT DECLINES THE VERSION AND THE SECTION NUMBER: `802.11n` and
    //    `ociluvyavya 1.1` have two digits and one, so neither shape can be reached from here.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 4) THE DECIMAL COMMA, NEUTRALISED RATHER THAN SPOKEN. There is no decimal word: `sources.ts` reports
    //    `[NONE] decimal-point — no _dpt, no _., no manifest word`, espeak has no umb at all, and there is
    //    no wiki to ask. The defect being fixed is the false clause break the mark produces mid-number —
    //    `14,7` read *ekwi la kwãla , epandu vali* — and dropping a mark beats speaking a word this corpus
    //    cannot supply (the Punjabi and Karakalpak choice, for the same reason).
    //    All twelve instances are decimals: `14,7` `1,5` `2,3` `38,48` `3,7` `2,8` `2,2` `163,52` `790,19`
    //    `3,50` `1,5`. Not one comma groups.
    s = s.replace(/(\d),(?=\d)/gu, "$1 ");

    // 5) THE CLOCK. The colon is clause punctuation in `umbundu.ts`, so `Eci kwapita 11:00, omanu` read as
    //    *ekwi la mosi , zelo , omanu* — a phrase break inside a time. 11 clocks: `1:15 lyomẽle`, `11:00`,
    //    `07:19 k’akukutu`, `21:19 GMT`, `9:30`, `8:46 lyomẽle`, `11:20`, `22:08`, `10:00`, `10:00-11:00`.
    //    The writer supplies the hour word where they want one (`07:19 k’akukutu`, `10 k’akukutu`), so only
    //    the colon is spent and the figures are left as figures.
    //    ⚠ THE RIGHT GUARD IS `(?!\.\d)`, NOT `(?![\d.,])` — trap 58 both ways. What must be excluded is a
    //    SPORTS TIME continuing into hundredths, and this corpus has three of them in one sentence
    //    (`4:41.30`, `2:11.60`, `1:09.02` — a downhill result, minutes and seconds, not a clock). A guard
    //    carrying a bare `.` would additionally decline every clause-final clock, and `Ombunje yafetika ko
    //    10:00.`-shaped sentence ends are exactly what this corpus writes.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!\.\d)/gu, "$1 $2");

    // 6) THE PORTUGUESE HOUR NOTATION. `20h30` and `15h00 UTC` — the `h` reached the g2p as a bare letter
    //    inside the figure (*akwi avali h akwi atatu*). Same treatment as the colon and for the same reason:
    //    no hour word is placed, because the corpus's own hour phrase is a clitic (`k’akukutu`) whose
    //    placement in this frame is unattested. ⚠ AFTER the clock step, so `21:19` cannot reach it, and
    //    bounded left and right so a word-internal ⟨h⟩ is untouchable.
    s = s.replace(/(?<![\p{L}\p{M}\d])([01]?\d|2[0-3])h([0-5]\d)(?![\p{L}\p{M}\d])/gu, "$1 $2");

    // 7) THE SPACED DASH IS A CLAUSE DASH — and this is the round's Karakalpak finding in a different mark.
    //    12 instances of `–` and 2 of a spaced `-`, and 11 of the 12 set off an apposition in running prose;
    //    neither `–` nor a spaced `-` is ever a minus here, and the ONE numeric `–` (`lyasoka 26 – 00`) is a
    //    SCORE, for which a pause is the right reading anyway. Neither mark is in `clausePunctuation`, so
    //    the pause was simply LOST — 12 of them (trap 17: a mark that should be a pause and instead vanishes
    //    is in scope).
    //    ⚠ SPACING, NOT SHAPE, IS THE DISCRIMINATOR: every real range in this corpus is written TIGHT
    //    (step 8), so requiring the spaces on both sides is what keeps this rule off them.
    s = s.replace(/ [-–] (?=\S)/gu, ", ");

    // 8) RANGES, TIGHT HYPHEN ONLY. The dash was dropped and the endpoints fused: `2-3 km` read *vali tatu
    //    km*, two numerals with nothing between them. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //    CONNECTIVE, the Karakalpak choice for the same reason: Umbundu writes the span out where it means
    //    it (`kolo 4 ale kolo 5`, `11.000 ko 22.500`, `okupisa ko 3.000`), so imposing a connective on a
    //    bare dash would double a word the writer had already chosen or deliberately not chosen.
    //    9 instances: `35-40 mph`, `56-64km/h`, `120-160 metelo`, `2-3 km`, `5-3`, `7-2`, `1644-1912`,
    //    `1000-1300 d. C.`, `10:00-11:00`.
    //    ⚠ THE LEFT GUARD REJECTS A LETTER, WHICH IS WHAT DECLINES `Covid-19` — a designation whose hyphen
    //    is correctly silent (trap 23: `\p{M}` sits beside `\p{L}` or the guard is blind wherever a nasal
    //    vowel is written decomposed). It also rejects a preceding digit, dot, comma or dash, so no match
    //    can begin inside a number the earlier steps have already joined (trap 52: a lookbehind rejects a
    //    POSITION, so the operand is anchored at BOTH ends).
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `Nadal apitĩla la Kanadiyanu yeyi
    //    7-2.` is clause-final — and an adjacent slash means a citation or a rate rather than a span.
    s = s.replace(/(?<![\p{L}\p{M}\d.,\-\/])(\d+)-(\d+)(?![\d\/])/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
