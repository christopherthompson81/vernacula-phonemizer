/**
 * The portable half of test/maltese.test.ts — Maltese / Malti (mt), the only Semitic language written in the
 * Latin alphabet. A greedy grapheme scan (the ⟨ie għ⟩ digraphs plus the silent-letter rules) + final
 * devoicing + regressive voicing assimilation + ⟨n⟩→m before a labial. Vowel length and stress are folded.
 *
 * Every expected value here is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;
using MtEngine = Vernacula.Phonemizer.Languages.Maltese.MaltesePhonemizer;
using MtNormalize = Vernacula.Phonemizer.Languages.Maltese.Normalize;

namespace Vernacula.Phonemizer.Tests;

public class MalteseTests
{
    private static readonly JsRe WS = JsRegex.Compile("\\s+", "gu");
    private static string Word(string s) => MtEngine.PhonemizeWord(s);
    /** The normalizer alone — pure text→text, which is where a wrong WORD would show. */
    private static string N(string s) => MtNormalize.NormalizeMaltese(s);
    private static string Say(string s) => Js.Trim(WS.Replace(new MtEngine().Text(s), " "));
    private static string Ph(string s) => Js.Trim(WS.Replace(Phonemizer.Phonemize(s, "mt"), " "));

    /** The Maltese-specific graphemes, the glottal ⟨q⟩, and the voicing rules. */
    [Theory]
    [InlineData("ċar", "t͡ʃar")]
    [InlineData("ġar", "d͡ʒar")]
    [InlineData("ħażin", "ħazɪn")]
    [InlineData("żmien", "zmɪn")]        // ⟨ż⟩ → z, ⟨ie⟩ → ɪ
    [InlineData("ċuċ", "t͡ʃut͡ʃ")]
    [InlineData("qalb", "ʔalp")]         // ⟨q⟩ → ʔ, final ⟨b⟩ devoices
    [InlineData("qattus", "ʔattus")]     // MEDIAL geminate kept
    [InlineData("Attard", "attart")]
    [InlineData("kiteb", "kɪtɛp")]
    [InlineData("ħobż", "ħɔps")]         // ⟨b⟩ devoices before the final ⟨ż⟩→s
    [InlineData("ġenb", "d͡ʒɛmp")]       // n→m before b, then final devoicing b→p
    public void ThePhonemizer(string word, string want) => Assert.Equal(want, Word(word));

    /** ⚠ THE SILENT LETTERS, which are the whole of this orthography's difficulty. ⟨għ⟩ and ⟨h⟩ are silent
     *  except WORD-FINALLY, where both surface as [ħ]; the vowel they leave behind then collapses. */
    [Theory]
    [InlineData("għamel", "amɛl")]       // word-initial ⟨għ⟩ silent
    [InlineData("xogħol", "ʃɔl")]        // medial ⟨għ⟩ silent
    [InlineData("biegħ", "bɪħ")]         // WORD-FINAL ⟨għ⟩ → [ħ]
    [InlineData("friegħ", "frɪħ")]
    [InlineData("deheb", "dɛp")]         // medial ⟨h⟩ silent, the a-a collapse, then final devoicing
    [InlineData("xahar", "ʃar")]
    [InlineData("fih", "fɪħ")]           // WORD-FINAL ⟨h⟩ → [ħ]
    [InlineData("tliet", "tlɪt")]
    [InlineData("Ħadd", "ħat")]          // final ⟨dd⟩ → single, then devoice → t
    [InlineData("mweġġa", "mwɛdd͡ʒa")]   // ⟨ġġ⟩ → d + d͡ʒ, the affricate gemination
    // ⚠ ⟨à ò ù⟩ read the SAME QUALITY as their plain counterparts — listed in NATIVE_CLASS for truth, not
    // for behaviour (#1140): the fold was reaching the right answer by the wrong route.
    [InlineData("attività", "attɪvɪta")]
    [InlineData("università", "unɪvɛrsɪta")]
    [InlineData("Perù", "pɛru")]
    public void TheSilentLettersAndGeminates(string word, string want) => Assert.Equal(want, Word(word));

    /** Cardinals — units-first inside 21–99, the DUAL for 2× a magnitude, and `u` on the final constituent. */
    [Theory]
    [InlineData("Il-Malti ħelu.", "ɪl maltɪ ħɛlu .")]
    [InlineData("0", "zɛrɔ")]
    [InlineData("2", "tnɛjn")]                       // the COUNTING form, not attributive żewġ
    [InlineData("10", "aʃra")]                       // għaxra — the ⟨għ⟩ silent
    [InlineData("21", "wɪħɛt u ɔʃrɪn")]              // UNITS-FIRST, the Semitic order
    [InlineData("45", "ħamsa u ɛrbɪn")]
    [InlineData("100", "mɪja")]
    [InlineData("200", "mɪtɛjn")]                    // the DUAL, never *żewġ mija
    [InlineData("555", "ħamɛs mɪja u ħamsa u ħamsɪn")]
    [InlineData("1000", "ɛlf")]                      // bare, no leading wieħed
    [InlineData("2000", "ɛlfɛjn")]                   // the DUAL again
    [InlineData("3000", "tlɪt ɛlɛf")]                // the -t attributive + PLURAL elef
    [InlineData("12345", "tnaʃɪl ɛlf tlɪt mɪja u ħamsa u ɛrbɪn")]
    [InlineData("1000000", "mɪljun")]
    [InlineData("2000000", "zɛwt͡ʃ mɪljunɪ")]        // żewġ miljuni — miljun has no dual
    public void TheCardinals(string text, string want) => Assert.Equal(want, Say(text));

    /**
     * COUNT AGREEMENT — the other load-bearing fact, and it is measured rather than assumed: Maltese takes
     * the PLURAL after 2–10 and the SINGULAR from 11 up, and a DECIMAL takes the plural.
     */
    [Theory]
    [InlineData("1 km", "1 kilometru")]
    [InlineData("2 km", "2 kilometri")]
    [InlineData("10 km", "10 kilometri")]
    [InlineData("11 km", "11 kilometru")]   // the Semitic flip
    [InlineData("100 km", "100 kilometru")]
    [InlineData("1.5 km", "1 punt 5 kilometri")]
    [InlineData("10.5 km", "10 punt 5 kilometri")]
    // ⚠ A plain Number() makes the FRACTION invisible when the decimal is a whole value: `68.0` parsed to 68
    // and took the singular while `30.2` in the same sentence took the plural. The fraction is detected from
    // the STRING, so these two are the same kind of number.
    [InlineData("68.0 °F", "68 punt 0 gradi Fahrenheit")]
    [InlineData("30.2 °F", "30 punt 2 gradi Fahrenheit")]
    public void TheCountAgreement(string text, string want) => Assert.Equal(want, N(text));

    /** De-grouping, and the one European-convention instance that is deliberately left as a clause comma. */
    [Theory]
    [InlineData("9,750,000", "9750000")]           // two passes: the first eats the second's start
    [InlineData("1,200 metru", "1200 metru")]
    [InlineData("8,2 %", "8,2 fil-mija")]          // ⚠ ×1 in the corpus; one instance buys no second convention
    [InlineData("fl-2018, l-akbar", "fl-2018, l-akbar")]  // a real clause comma, untouched
    [InlineData("12.5%", "12 punt 5 fil-mija")]
    [InlineData("$88.08 biljun", "88 punt 08 biljun dollaru")]
    public void TheDeGrouping(string text, string want) => Assert.Equal(want, N(text));

    /**
     * THE MINUS, narrowed by measurement to the two unambiguous contexts. ⚠ In Maltese the character before
     * a hyphen is usually a LETTER — `it-43.8°C`, `l-1%` are the definite article — so the rule is anchored
     * on what PRECEDES the sign AND on what FOLLOWS the number. `fl -2021` is the one false positive the
     * opener-only shape produced, and the right context excludes it.
     */
    [Theory]
    [InlineData("-3 °C", "minus 3 gradi Ċelsju")]
    [InlineData("−8 °C", "minus 8 gradi Ċelsju")]   // U+2212, the real minus sign
    [InlineData("-9.7%", "minus 9 punt 7 fil-mija")]
    [InlineData("it-43.8°C", "it-43 punt 8 gradi Ċelsju")]
    [InlineData("l-1% tal-voti", "l-1 fil-mija tal-voti")]
    [InlineData("fl -2021", "fl -2021")]
    public void TheMinus(string text, string want) => Assert.Equal(want, N(text));

    /** Degrees — °C/°F only; the BARE degree sign is declined, because 15 of the 51 in the corpus are
     *  coordinates and a bare-° rule would cut one in half with no minutes/seconds reading to put back. */
    [Theory]
    [InlineData("20 °C", "20 grad Ċelsju")]
    [InlineData("3 °C", "3 gradi Ċelsju")]
    [InlineData("1.2°C", "1 punt 2 gradi Ċelsju")]
    [InlineData("39 °F", "39 grad Fahrenheit")]
    [InlineData("42° 35' 34\"", "42° 35' 34\"")]
    [InlineData("7.6° fuq l-iskala Richter", "7 punt 6° fuq l-iskala Richter")]
    public void TheDegrees(string text, string want) => Assert.Equal(want, N(text));

    /**
     * ERA MARKERS. ⚠ THE SECOND DOT IS SOMETIMES A FULL STOP TOO, and swallowing it merged two sentences.
     * The discriminator is the writer's own CAPITALISATION — the dot is re-emitted when the next non-space
     * character is upper-case or the input ends, which is the same evidence a human reader has.
     */
    [Theory]
    [InlineData("600 Q.K.", "600 Qabel Kristu.")]                      // ends the input ⇒ the stop is real
    [InlineData("2200 QK", "2200 Qabel Kristu")]                       // the undotted form
    [InlineData("60 W.K.", "60 Wara Kristu.")]
    [InlineData("tas-seklu 10 w.K.", "tas-seklu 10 Wara Kristu.")]     // ⚠ the lowercase variant
    [InlineData("fis-73 W.K. Ruma waqgħet.", "fis-73 Wara Kristu. Ruma waqgħet.")]
    [InlineData("tas-seklu 18 Q.K. u l-Imperu", "tas-seklu 18 Qabel Kristu u l-Imperu")]
    [InlineData("sat-68 QK Malta", "sat-68 Qabel Kristu Malta")]
    // …and the bound excludes a match inside a longer all-caps token.
    [InlineData("QUARTO", "QUARTO")]
    [InlineData("Mikroqk", "Mikroqk")]
    public void TheEraMarkers(string text, string want) => Assert.Equal(want, N(text));

    /** Percent — INVARIANT, deliberately: `fil-mija` is a prepositional phrase, not a countable noun, so it
     *  is the one place in this layer where the agreement rule does not apply. */
    [Theory]
    [InlineData("40%", "40 fil-mija")]
    [InlineData("60 %", "60 fil-mija")]
    [InlineData("3 %", "3 fil-mija")]
    [InlineData("11.6%", "11 punt 6 fil-mija")]
    public void ThePercentIsInvariant(string text, string want) => Assert.Equal(want, N(text));

    /** Currency, and the `-il` linked magnitude the tier could not cross. */
    [Theory]
    [InlineData("€5", "5 ewro")]
    [InlineData("€487 miljun", "487 miljun ewro")]
    [InlineData("$250,000", "250000 dollaru")]
    [InlineData("$5", "5 dollari")]
    [InlineData("€12-il miljun", "12-il miljun ewro")]
    [InlineData("£1.60 sterlini", "1 punt 60 sterlini")]
    public void TheCurrency(string text, string want) => Assert.Equal(want, N(text));

    /** Units, the exponent, and the guards that must REFUSE. */
    [Theory]
    [InlineData("20 cm", "20 ċentimetru")]
    [InlineData("5 cm", "5 ċentimetri")]
    [InlineData("5 ċm", "5 ċentimetri")]        // the language's OWN spelling of the same key
    [InlineData("20 mi", "20 mil")]
    [InlineData("5 mi", "5 mili")]
    [InlineData("3900 ft", "3900 pied")]        // invariant: `piedi` is ×0 in every source
    [InlineData("11,100 sq mi", "11100 mil kwadru")]
    [InlineData("2,764 m", "2764 metru")]
    [InlineData("6.5m", "6 punt 5 metri")]      // glued to a decimal: genuinely metres
    // ⚠ THE DECIMAL STEP RUNS LAST, WHICH IS WHAT KEEPS THE TIER'S VERSION GUARD ARMED. A layer that spends
    // the dot BEFORE the tier leaves it nothing to reject, and `802.11m` reads as "…eleven METRES" — the
    // defect that broke af, ca, is and sd.
    [InlineData("802.11m", "802 punt 11m")]
    [InlineData("802.11n", "802 punt 11n")]
    [InlineData("10 l", "10 l")]                // an undeclared unit is left alone
    [InlineData("15 t'Ottubru", "15 t'Ottubru")]
    [InlineData("20 km²", "20 kilometru kwadru")]
    [InlineData("2 km²", "2 kilometri kwadri")] // both words inflect
    [InlineData("20 m³", "20 metru kubu")]
    [InlineData("2 m³", "2 metri kubi")]
    [InlineData("28,748 km2", "28748 kilometru kwadru")]  // the ASCII exponent too
    public void TheUnitsAndExponent(string text, string want) => Assert.Equal(want, N(text));

    /**
     * THE RATE — local, because the idiom is not "A per B": Maltese says *kilometri FIS-SIEGĦA*, a
     * preposition fused with the definite article and its noun, which `UnitPer` cannot spell.
     * ⚠ THE DENOMINATOR TABLE IS CLOSED — `h` and `s` are the only two this corpus writes — AND AN
     * UNLISTED DENOMINATOR NOW READS ITS NUMERATOR AND STRANDS THE REST. The residual here has moved
     * twice: `5 kilometri/j` before #1093, `5 km/j` under #1098's whole-match decline, and
     * `5 kilometri/j` again since #1249 measured that declining never made the `/j` any more visible
     * than stranding it does — the price was the NUMERATOR's reading in 146 of the 193 registry codes.
     * The TS twin (`test/maltese.test.ts`) carries the same three-step history.
     *
     * ⚠ THE DEGENERATE SHAPE IS UNCHANGED THROUGHOUT, IN BOTH ENGINES IDENTICALLY: a trailing slash with
     * no denominator at all, `5 km/` → *5 kilometri/*. Not a parity defect (TS and C# agree byte-for-byte)
     * and not corpus-attested; recorded rather than repaired, so the next reader does not re-derive it.
     */
    [Theory]
    [InlineData("300 km/h", "300 kilometru fis-siegħa")]
    [InlineData("7 km/h", "7 kilometri fis-siegħa")]
    [InlineData("100 m/s", "100 metru fis-sekonda")]
    [InlineData("3 m/s", "3 metri fis-sekonda")]
    [InlineData("16.5 m/s", "16 punt 5 metri fis-sekonda")]
    [InlineData("300,000 km/s", "300000 kilometru fis-sekonda")]
    [InlineData("5 cm/s", "5 ċentimetri fis-sekonda")]
    [InlineData("20 km / h", "20 kilometru fis-siegħa")]   // spaced slash, either side
    [InlineData("5 km/j", "5 kilometri")]                  // an unlisted denominator is DROPPED (#1255)
    [InlineData("5 m/kg", "5 metri")]
    [InlineData("5 km/", "5 kilometri/")]                  // ⚠ the degenerate residual, pinned as it reads
    public void TheRate(string text, string want) => Assert.Equal(want, N(text));

    /** The `-il` linker between a number and a unit symbol — MATCHED and RE-EMITTED, never stripped,
     *  because it is a real morpheme of the spoken numeral. */
    [Theory]
    [InlineData("16-il ċm", "16-il ċentimetru")]
    [InlineData("16-il cm", "16-il ċentimetru")]     // …and the Latin spelling, identically
    [InlineData("15-il km", "15-il kilometru")]
    [InlineData("48,514-il m", "48514-il metru")]    // de-grouped first, ≥11 → singular
    [InlineData("12-il mil", "12-il mil")]           // already a word, untouched
    [InlineData("12-il minuta", "12-il minuta")]
    [InlineData("15-il kilometru", "15-il kilometru")]
    [InlineData("16-il km²", "16-il km²")]           // the exponent and rate forms are left to their steps
    // ⚠ THE BARE ARM'S RATE, NOT THE COUNTED ONE'S — the linker makes the numeral non-adjacent, so only
    // `MakeBareUnitNormalizer` can see this `km`, and its trailing `/` guard stays (see the TS).
    [InlineData("16-il km/h", "16-il km/h")]
    public void TheIlLinker(string text, string want) => Assert.Equal(want, N(text));

    /**
     * ⚠ THE THREE-DIGIT BLOCK IS GROUPING, NOT A DECIMAL, and the two rules that resolve their own
     * agreement must answer it the same way the tier does — the identical numeral was taking opposite
     * agreement in two rules of the same file before `NumeralValue` became the tier's own expression.
     */
    [Theory]
    [InlineData("1.234 °C", "1 punt 234 grad Ċelsju")]        // the local degree rule …
    [InlineData("1.234 m", "1 punt 234 metru")]               // … and the tier: both singular
    [InlineData("1.234 m/s", "1 punt 234 metru fis-sekonda")] // … and the local rate rule
    [InlineData("1.23 °C", "1 punt 23 gradi Ċelsju")]         // a real fraction ⇒ plural, all three
    [InlineData("1.23 m", "1 punt 23 metri")]
    public void TheGroupingBlockAgreesAcrossAllThreeRules(string text, string want) =>
        Assert.Equal(want, N(text));

    /** The clock, which the decimal step must not claim. ⚠ THE MINUTE-NOUN IS DELIBERATELY NOT EMITTED:
     *  the corpus readers do not agree on it (bare / minuta / dsatax-il minuta / tmien minuti), and
     *  choosing one agreement would be wrong more often than silence is. */
    [Theory]
    [InlineData("9.40am", "9 u 40am")]
    [InlineData("8.30 p.m.", "8 u nofs p.m.")]
    [InlineData("fl-4.00 ta' filgħodu", "fl-4 ta' filgħodu")]   // :00 is the hour ALONE
    [InlineData("15:00 utc", "3 utc")]                          // 13–23 are spoken as 1–11
    [InlineData("00:30", "12 u nofs")]
    [InlineData("8:46", "8 u 46")]                              // no `nieqes kwart` — that is a reader's rounding
    // ⚠ THE TIMEZONE IS IN THE TAIL LIST BECAUSE `f'12.00 GMT` WAS NOT (#1102): it fell through to the
    // decimal rule and read "twelve point zero", the exact confidently-wrong reading the guard prevents.
    [InlineData("f’12.00 GMT illum", "f’12 GMT illum")]
    // …and a genuine decimal with no clock tail is still a decimal.
    [InlineData("6.34 pulzieri", "6 punt 34 pulzieri")]
    [InlineData("3.50 m", "3 punt 50 metri")]
    [InlineData("88.08 biljun", "88 punt 08 biljun")]
    [InlineData("2:2 lawrija", "2:2 lawrija")]                  // a degree class, not a time
    public void TheClock(string text, string want) => Assert.Equal(want, N(text));

    /** The ampersand → `u`, the Maltese conjunction — which is the manifest's own numeral connector and
     *  espeak's `mt_list` independently. `R&Ż` is *Riċerka u Żvilupp*, where ⟨u⟩ is literally the expansion. */
    [Theory]
    [InlineData("B&B", "B u B")]
    [InlineData("R&Ż", "R u Ż")]
    public void TheAmpersand(string text, string want) => Assert.Equal(want, N(text));

    /** End to end, where the point is that the pipeline downstream actually speaks what the layer emits. */
    [Theory]
    [InlineData("40%", "ɛrbɪn fɪl mɪja")]
    [InlineData("-1 °C", "mɪnus wɪħɛt ɡrat t͡ʃɛlsju")]   // ⟨Ċelsju⟩ → t͡ʃ, not the /k/ of ⟨Celsius⟩
    [InlineData("2.6cm", "tnɛjn punt sɪtta t͡ʃɛntɪmɛtrɪ")] // NOT the *km* it read before
    [InlineData("€487 miljun", "ɛrba mɪja u sɛba u tmɛnɪn mɪljun ɛwrɔ")]
    [InlineData("600 Q.K.", "sɪt mɪja ʔabɛl krɪstu .")]   // no INTERIOR pause; the final one stands
    [InlineData("100 m/s", "mɪja mɛtru fɪs sɛkɔnda")]     // not *mɛtru s*, a stranded letter
    [InlineData("16-il ċm", "sɪttaʃ ɪl t͡ʃɛntɪmɛtru")]    // not *t͡ʃm*, a raw symbol
    public void EndToEnd(string text, string want) => Assert.Equal(want, Say(text));

    /** Through the REGISTRY, where the currency-magnitude hop and the agreement are settled together. */
    [Theory]
    [InlineData("$5", "ħamsa dɔllarɪ")]                   // n ≤ 10 → plural
    [InlineData("$11", "ħdaʃ dɔllaru")]                   // n ≥ 11 → singular
    [InlineData("3.6 km", "tlɪta punt sɪtta kɪlɔmɛtrɪ")]  // a fraction → plural
    [InlineData("l-11:00", "l ħdaʃ")]                     // hour ALONE — was *l ħdaʃ , zɛrɔ*
    [InlineData("fit-8:30 ta' filgħaxija", "fɪt tmɪnja u nɔfs ta fɪlaʃɪja")]
    [InlineData("fil-11:20", "fɪl ħdaʃ u ɔʃrɪn")]
    // ⚠ ONE O'CLOCK IS `siegħa`, NOT `wieħed`: the hour is feminine in the clock frame, and the written
    // article agrees with it (`fis-` < *fi + is-* selects *siegħa*).
    [InlineData("fis-1:15 ta' filgħodu", "fɪs sɪa u kwart ta fɪlɔdu")]
    [InlineData("kafà", "kafa")]
    [InlineData("kafò", "kafɔ")]
    public void ThroughTheRegistry(string text, string want) => Assert.Equal(want, Ph(text));

    /** The magnitude hop keeps the currency word after the whole magnitude phrase, never inside it. */
    [Theory]
    [InlineData("$745 miljun", "mɪljun dɔllaru")]
    [InlineData("€1 biljun", "bɪljun ɛwrɔ")]
    [InlineData("5 miljun tunnellata", "mɪljun tunnɛllata")]
    public void TheMagnitudeHop(string text, string want) => Assert.Contains(want, Ph(text));

    /** ⚠ THE GRAVE VOWELS READ THE SAME QUALITY as their plain counterparts, which is why listing them in
     *  NATIVE_CLASS moved no output (#1140) — the fold was reaching the right answer by the wrong route. */
    [Fact]
    public void TheGraveVowelsMatchTheirPlainCounterparts()
    {
        Assert.Equal(Ph("kafa"), Ph("kafà"));
        Assert.Equal(Ph("kafo"), Ph("kafò"));
    }
}
