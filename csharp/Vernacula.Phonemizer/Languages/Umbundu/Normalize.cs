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
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Umbundu;

public static class Normalize
{
    /**
     * The shared SYMBOL tier. THREE declarations, no more. ⚠ NO `exponentWords`, NO `unitPer`, NO
     * `magnitudes`, and NEITHER PREFIX FLAG.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porcento" },
        // ⚠ ONE-LETTER KEY, AND ITS SAFETY IS THE ORDERING BELOW. The tier's `NOT_VERSION` guard works by
        // seeing the DOT (traps 39/46), and this corpus writes `802.11n` — so the tier MUST run before step 4
        // spends the thousands dot. Measured: every digit-adjacent `m` in this corpus is a genuine metre.
        Units = new Dictionary<string, IReadOnlyList<string>> { ["m"] = new[] { "metelo" } },
        Ampersand = "kwenda",
    });

    private static readonly JsRe IOTA_LOWER = JsRegex.Compile("ῖ", "gu");
    private static readonly JsRe IOTA_UPPER = JsRegex.Compile("Ῑ", "gu");
    private static readonly JsRe DOT_GROUP = JsRegex.Compile("(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!\\.\\d)", "gu");
    private static readonly JsRe HOUR_H = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])([01]?\\d|2[0-3])h([0-5]\\d)(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile(" [-–] (?=\\S)", "gu");
    private static readonly JsRe TIGHT_RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d.,\\-\\/])(\\d+)-(\\d+)(?![\\d\\/])", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Umbundu input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeUmbundu(string input)
    {
        var s = input;

        // 1) THE GREEK IOTA, FOLDED TO THE LATIN NASAL VOWEL IT IS DRAWN AS. ⚠ FIRST, because it is a
        //    SPELLING repair and every later step's word boundary would otherwise treat the stray letter as
        //    a boundary too. Both cases, though only the lowercase occurs (×10).
        s = IOTA_UPPER.Replace(IOTA_LOWER.Replace(s, "ĩ"), "Ĩ");

        // 2) THE SHARED SYMBOL TIER, ordered as the Karakalpak and Punjabi layers order it: its own numeral
        //    pattern reads `3.850` and `163,52` as ONE token, and steps 3 and 4 split precisely those. It
        //    also has to see the version dot of `802.11n` while it still exists.
        s = SYMBOLS(s);

        // 3) DE-GROUPING THE THOUSANDS DOT. Portuguese convention, and the three-digit test is unanimous
        //    here. Untouched, the dot read as a FULL STOP inside the number — the worst defect in this
        //    corpus and one no leak class can see. ⚠ THE WHOLE NUMBER AT ONCE (trap 63). ⚠ THE TRAILING
        //    GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58). ⚠ AND THE EXACT `\d{3}` IS WHAT DECLINES THE
        //    VERSION AND THE SECTION NUMBER: `802.11n` and `ociluvyavya 1.1` cannot be reached from here.
        s = DOT_GROUP.Replace(s, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));

        // 4) THE DECIMAL COMMA, NEUTRALISED RATHER THAN SPOKEN. There is no decimal word (`sources.ts`
        //    reports `[NONE]`, espeak has no umb, there is no wiki to ask). Dropping a mark beats speaking a
        //    word this corpus cannot supply. All twelve instances are decimals; not one comma groups.
        s = DECIMAL_COMMA.Replace(s, "$1 ");

        // 5) THE CLOCK. The colon is clause punctuation, so `11:00` read with a phrase break inside the
        //    time. The writer supplies the hour word where they want one, so only the colon is spent.
        //    ⚠ THE RIGHT GUARD IS `(?!\.\d)`, NOT `(?![\d.,])` — trap 58 both ways: a SPORTS TIME continuing
        //    into hundredths must be excluded, but a guard carrying a bare `.` would decline every
        //    clause-final clock.
        s = CLOCK.Replace(s, "$1 $2");

        // 6) THE PORTUGUESE HOUR NOTATION. `20h30` and `15h00 UTC` — the `h` reached the g2p as a bare
        //    letter inside the figure. ⚠ AFTER the clock step, so `21:19` cannot reach it, and bounded left
        //    and right so a word-internal ⟨h⟩ is untouchable.
        s = HOUR_H.Replace(s, "$1 $2");

        // 7) THE SPACED DASH IS A CLAUSE DASH. 11 of 12 set off an apposition in running prose; the ONE
        //    numeric `–` is a SCORE, for which a pause is the right reading anyway. ⚠ SPACING, NOT SHAPE, IS
        //    THE DISCRIMINATOR: every real range in this corpus is written TIGHT (step 8).
        s = SPACED_DASH.Replace(s, ", ");

        // 8) RANGES, TIGHT HYPHEN ONLY. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE — Umbundu
        //    writes the span out where it means it. ⚠ THE LEFT GUARD REJECTS A LETTER (declines `Covid-19`)
        //    and a preceding digit/dot/comma/dash (trap 52). ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND
        //    NUMBER (trap 58) — `7-2.` is clause-final — and an adjacent slash means a citation or a rate.
        s = TIGHT_RANGE.Replace(s, "$1, $2");

        // A padded replacement doubles a space that was already there. SLOT-GAP is a defect class and this
        // pass should not be the one producing candidates for it.
        return MULTI_SPACE.Replace(s, " ");
    }
}
