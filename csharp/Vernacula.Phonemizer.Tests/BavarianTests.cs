// The portable half of test/bavarian.test.ts — Bavarian (bar), over the de-facto Bavarian-Wikipedia
// orthography. See the TS test for the corpus evidence behind each fixture.
//
// ⚠ THE BRANCHES ARE PINNED, NOT THE CORPUS'S INSTANCES: each normalizer rule is exercised on a case it
// CLAIMS and on its nearest adversarial neighbour that it must DECLINE — the sentence-final `N.` beside the
// ordinal, the triangle side-ratio beside the clock, the year-range beside the fraction, the ISBN beside the
// signed temperature. The 200-row golden exercises all of this only in bulk.
using Vernacula.Phonemizer;
using BarEngine = Vernacula.Phonemizer.Languages.Bavarian.BavarianPhonemizer;
using BarNormalize = Vernacula.Phonemizer.Languages.Bavarian.Normalize;
using BarNumbers = Vernacula.Phonemizer.Languages.Bavarian.Numbers;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class BavarianTests
{
    [Theory]
    // The falling diphthongs ⟨ia ua oa⟩ — Bavarian's hallmark — plus the closing ones.
    [InlineData("Boarisch", "b̥oɐ̯riʃ")]   // ⟨oa⟩→oɐ̯, ⟨sch⟩→ʃ
    [InlineData("Biaschtl", "b̥iɐ̯ʃd̥l")]  // ⟨ia⟩→iɐ̯, lenis ⟨t⟩→d̥
    [InlineData("Aug", "ɑɔ̯ɡ̥")]           // ⟨au⟩→ɑɔ̯, lenis ⟨g⟩→ɡ̥
    [InlineData("Foi", "foe")]              // ⟨oi⟩→oe (l-vocalization)
    // Fortis/lenis neutralization: ⟨t p⟩ lenite unconditionally, ⟨k⟩ everywhere but a word-initial
    // prevocalic onset.
    [InlineData("Taag", "d̥aːɡ̥")]          // ⟨t⟩→d̥ word-initial, ⟨aa⟩→aː
    [InlineData("Klass", "ɡ̥lɑs")]          // initial ⟨k⟩ before a LIQUID lenites
    [InlineData("Kaas", "kaːs")]            // …but a word-initial PREVOCALIC ⟨k⟩ stays fortis (⟨aa⟩→aː)
    [InlineData("Bånk", "b̥ɔŋɡ̥")]          // coda ⟨k⟩→ɡ̥, and ⟨n⟩→ŋ before the velar it became
    // R-vocalization, final-⟨a⟩ reduction, ⟨gn⟩ coalescence.
    [InlineData("Bana", "b̥ɑnɐ")]           // final unstressed ⟨-a⟩→ɐ
    [InlineData("Wåssa", "ʋɔsɐ")]           // ⟨w⟩→ʋ, ⟨å⟩→ɔ, geminate ⟨ss⟩→s, final ⟨a⟩→ɐ
    [InlineData("Regn", "reŋ")]             // word-final ⟨gn⟩ → ŋ
    [InlineData("rot", "rod̥")]             // a PREVOCALIC onset ⟨r⟩ keeps its trill
    // Post-vocalic ⟨h⟩ is silent; the ich/ach dorsal split.
    [InlineData("Fruah", "fruɐ̯")]
    [InlineData("Fühn", "fyn")]
    [InlineData("Dånkschee", "d̥ɔŋɡ̥ʃeː")]
    public void TheGrapemeScanReadsWhatItClaims(string word, string want) =>
        Assert.Equal(want, BarEngine.PhonemizeWord(word));

    [Fact]
    public void ClauseAssembly() =>
        Assert.Equal("i b̥in ɑ b̥oɐ̯ɐ̯ .", Phonemizer.Phonemize("I bin a Boar.", "bar").Trim());

    // Cardinals — units-first with the reduced ⟨-a-⟩ linker; magnitudes written OPEN (a closed *dreihundad
    // would lose its ⟨h⟩ to the silent post-vocalic-h rule).
    [Theory]
    [InlineData(0, "null")]
    [InlineData(21, "oanazwånzg")]        // compound stem oan- (not oans-)
    [InlineData(22, "zwoarazwånzg")]      // compound stem zwoar- (the hiatus-breaking ⟨r⟩)
    [InlineData(45, "fimfafiazg")]
    [InlineData(99, "neinaneinzg")]
    [InlineData(100, "hundad")]
    [InlineData(555, "fimf hundad fimfafuchzg")]
    [InlineData(1000, "dausnd")]
    [InlineData(12345, "zwöif dausnd drei hundad fimfafiazg")]
    [InlineData(1000000, "oa Million")]
    [InlineData(1000000000, "oa Milliarde")]
    public void UnitsFirstWithTheReducedLinker(int n, string want) =>
        Assert.Equal(want, BarNumbers.NumberToWords(n));

    [Theory]
    [InlineData("21", "oɐ̯nɑt͡sʋɔnt͡sɡ̥")]
    [InlineData("555", "fimf hund̥ɑd̥ fimfɑfuxt͡sɡ̥")]
    public void NumbersWiredIntoThePhonemizer(string input, string want) =>
        Assert.Equal(want, Phonemizer.Phonemize(input, "bar").Trim());

    // ── TEXT NORMALIZATION ───────────────────────────────────────────────────────────────────────────
    // ⚠ Asserted on NormalizeBavarian — TEXT, not IPA — wherever the point is which WORDS the layer chooses:
    // the g2p lowercases before scanning, so a capitalization or word choice can be invisible in the IPA.

    /** Unhandled, `nbsp` phonemized as a WORD plus a comma pause from the `;`. */
    [Fact]
    public void NbspFoldsToASpaceAndNotToADeletion()
    {
        Assert.Equal("67 Kilometa", BarNormalize.NormalizeBavarian("67&nbsp;km"));
        // Substituted, never deleted: the number and its unit stay two tokens.
        Assert.Equal("simɑseçt͡sɡ̥ kilomed̥ɐ", Phonemizer.Phonemize("67&nbsp;km", "bar").Trim());
        // ⚠ It must run FIRST, or every guard behind it is blind — this °C is invisible to a rule expecting
        // a space.
        Assert.Equal("minus 13 Grad Celsius", BarNormalize.NormalizeBavarian("-13&nbsp;°C"));
    }

    [Fact]
    public void PeriodGroupedThousandsLoseTheDotBeforeItBecomesAPhraseBreak()
    {
        // ⚠ THE INTERNAL CAPITAL IS REAL AND IS NOT A DEFECT: `compound` concatenates the measure word onto a
        // unit noun Bavarian capitalises. The g2p lowercases, so the IPA matches the tidy spelling — asserted
        // on the next line so the claim is checked rather than stated.
        Assert.Equal("30528 QuadratKilometa", BarNormalize.NormalizeBavarian("30.528 km²"));
        Assert.Equal("d̥rɑɛ̯sɡ̥ d̥ɑɔ̯snd̥ fimf hund̥ɑd̥ ɔxd̥ɑt͡sʋɔnt͡sɡ̥ kvɑd̥rɑd̥ɡ̥ilomed̥ɐ",
            Phonemizer.Phonemize("30.528 km²", "bar").Trim());
        Assert.Equal("4324782 QuadratKilometa", BarNormalize.NormalizeBavarian("4.324.782 km²")); // multi-group
        // ⚠ THE VERSION DOT SURVIVES, which is what keeps the one-letter `m` unit key safe: the group must be
        // exactly three digits.
        Assert.Contains("8140.43P", BarNormalize.NormalizeBavarian("8140.43P"));
        // The space-grouped form too — the group was reading as a separate numeral.
        Assert.Equal("549000 Eiro", BarNormalize.NormalizeBavarian("549 000 €"));
    }

    [Theory]
    // A range ASCENDS, which is what separates it from a part number and an ISBN.
    [InlineData("Beziak 5 - 8", "Beziak 5 bis 8")]
    [InlineData("vo 1961 -1990", "vo 1961 bis 1990")]
    [InlineData("1863–1952", "1863 bis 1952")] // en dash
    // ⚠ THE ONE COUNTER-EXAMPLE IN THE BAVARIAN SUBSET: an Austrian standard's part number descends.
    [InlineData("ÖNORM B 8115-2", "ÖNORM B 8115-2")]
    // ⚠ AND THE CHAIN GUARDS ARE WHAT KEEP ISBNs OUT, which the ordering test alone would not — `3-86520`
    // ascends. A dash on either side disqualifies the pair, so every link of a chain is rejected.
    [InlineData("ISBN 3-86520-078-8", "ISBN 3-86520-078-8")]
    [InlineData("ISBN 978-3-484-23134-4", "ISBN 978-3-484-23134-4")]
    // An ORDINAL range keeps its dots and is declined by both rules.
    [InlineData("(10.–23.) is aa", "(10.–23.) is aa")]
    public void ARangeAscends(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Theory]
    // Licensed by the FOLLOWING word — a Bavarian month name or an ordinal noun.
    [InlineData("am 10. Novemba 1989", "am zehntn Novemba 1989")]
    [InlineData("im 20. Joahundat", "im zwanzigstn Joahundat")]
    // Licensed by the PRECEDING article plus a capitalised noun.
    [InlineData("da 2. Buachstob", "da zwoate Buachstob")]
    // ⚠ THE SENTENCE-FINAL PERIODS, which must NOT be claimed. ⚠ The ISBN is written out IN FULL rather than
    // truncated: a two-link `3-8` is an ascending pair with no chain around it, so the RANGE rule would claim
    // it — shortening this fixture changes which rule owns it.
    [InlineData("Minga, 2005. ISBN 3-86520-078-8", "Minga, 2005. ISBN 3-86520-078-8")]
    [InlineData("im Joar 1904. Und daun", "im Joar 1904. Und daun")]
    // ⚠ AND THEY DECLINE WHERE THE WORD IS UNSOURCED rather than composing a wrong one.
    [InlineData("De 4. Auflage", "De 4. Auflage")]
    [InlineData("da 7. Beziak", "da 7. Beziak")]
    // ⚠ THE ENDING FOLLOWS THE PREPOSITION IN FRONT OF THE ARTICLE, not just the article: `da` is both the
    // masculine nominative article and the feminine dative one.
    [InlineData("vo da 1. Person", "vo da easchtn Person")]
    [InlineData("in da 2. Person", "in da zwoatn Person")]
    // `um` governs the accusative and both of its corpus instances take -e, so it is NOT in the set.
    [InlineData("um de 3. Person", "um de dritte Person")]
    [InlineData("aa de 2. Person", "aa de zwoate Person")]
    public void OrdinalsFireOnTheirLicenserAndNowhereElse(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    /** The sentence-final period the ordinal rule declined is still a PAUSE in the phoneme stream. */
    [Fact]
    public void TheDeclinedSentenceEndKeepsItsPause() =>
        Assert.Contains(" . ", Phonemizer.Phonemize("im Joar 1904. Und daun", "bar").Trim());

    [Theory]
    [InlineData("z. B. in da Regionalliga", "zum Beispui in da Regionalliga")]
    [InlineData("bzw. bairisch", "beziehungsweise bairisch")]
    [InlineData("za. 208.000 Eihw.", "zirka 208000 Eihwohna.")]
    // ⚠ The continuation lookahead admits a CURRENCY SIGN: without it `Mrd.` fell through unexpanded and took
    // the `€` with it.
    [InlineData("21,905 Mrd. €", "21,905 Milliardn Eiro")]
    public void AbbreviationsExpandIntoWordsTheCorpusItselfSpellsOut(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Theory]
    [InlineData("12:15", "zwöif Uhr fuchzea")]
    // ⚠ THE RANGE IS CLAIMED FIRST, or the hyphen fuses the two rewritten clocks into ONE token — the TOKEN
    // class admits `-` inside a word run.
    [InlineData("5:00-9:00 Uhr", "fimf bis nein Uhr")]
    // ⚠ A THIRD FIELD IS NOT A CLOCK — these are triangle side-ratios, and the lookbehind must exclude a
    // COLON and not only a digit, or the rule restarts in the MIDDLE of the run and claims `15:36`.
    [InlineData("Seitnvoöitnis 39:15:36", "Seitnvoöitnis 39:15:36")]
    [InlineData("gkiazt: 13:5:12", "gkiazt: 13:5:12")]
    public void TheClockAndTheTwoSideRatiosItDeclines(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Fact]
    public void TheClockRangeStaysTwoTokens() =>
        Assert.Equal("fimf b̥is nɑɛ̯n uɐ̯", Phonemizer.Phonemize("5:00-9:00 Uhr", "bar").Trim());

    [Theory]
    [InlineData("8,2 °C", "8,2 Grad Celsius")]
    [InlineData("℃ folds", "°C folds")] // one code point meaning what °C means
    [InlineData("360°", "360 Grad")]
    public void DegreesTheTemperatureAndTheCoordinate(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    /** ⚠ THE COMPOUND HYPHEN IS CONSUMED, for the clock range's reason: `90 Grad-Winkl` fused into one token. */
    [Fact]
    public void TheCompoundDegreeHyphenIsConsumed() =>
        Assert.Equal("nɑɛ̯nt͡sɡ̥ ɡ̥rɑd̥ ʋiŋɡ̥l", Phonemizer.Phonemize("90°-Winkl", "bar").Trim());

    [Theory]
    // Every real sign in the corpus is followed by a degree word; no counter-example is.
    [InlineData("bei -13 °C und +15 °C", "bei minus 13 Grad Celsius und plus 15 Grad Celsius")]
    [InlineData("woa −45,9 Grad Celsius", "woa minus 45,9 Grad Celsius")]
    // ⚠ BOTH ENDS OF A SIGNED RANGE, and this is the one that must not half-fire: only the second number has
    // a degree word directly after it, so a lookahead that cannot reach across the joiner reads a span from
    // POSITIVE one to minus two. Omitting a plus is lossless; omitting a minus INVERTS.
    [InlineData("−1 bis −2 °C", "minus 1 bis minus 2 Grad Celsius")]
    [InlineData("mit -0,5 beziehungsweise -1,4 °C", "mit minus 0,5 beziehungsweise minus 1,4 Grad Celsius")]
    // …and an UNSIGNED range across the same joiner is untouched.
    [InlineData("mit 18 beziahungsweis 17 °C", "mit 18 beziahungsweis 17 Grad Celsius")]
    // A general `(^|\s)[-−–](\d)` rule would read these as *minus 1990* and *minus 8*. The sign rule declines
    // both and the RANGE rule then claims them — the two rules disagreeing correctly is what is under test.
    [InlineData("de Joar vo 1961 -1990", "de Joar vo 1961 bis 1990")]
    [InlineData("bisherign Beziak 5 - 8", "bisherign Beziak 5 bis 8")]
    [InlineData("ISBN 3-86520-078-8", "ISBN 3-86520-078-8")]
    public void TheSignIsReadOnlyInTheDegreeSlot(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Theory]
    [InlineData("håt 2/3 vo da Produktion", "håt zwoa Driddl vo da Produktion")]
    // ⚠ A NUMERATOR OF 1 TAKES THE ARTICLE, not the counting form — the corpus diff surfaced *oans Driddl*.
    [InlineData("håt 1/3", "håt a Driddl")]
    [InlineData("1/2 und 1/4", "a hoib und a Viadl")]
    // A German-style `\d{1,3}/\d{1,3}` rule would claim both of these: one is a winter, one is a car.
    [InlineData("im Winta 469/470", "im Winta 469/470")]
    [InlineData("Santana 300/350", "Santana 300/350")]
    // …and an unsourced denominator is left alone rather than composed.
    [InlineData("3/7 vo da Fläch", "3/7 vo da Fläch")]
    public void FractionsTheOneAttestedDenominatorSeries(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Theory]
    [InlineData("59% vo da Beväikarung", "59 Prozent vo da Beväikarung")]
    [InlineData("2,1 % im Sektor", "2,1 Prozent im Sektor")]
    // ⚠ `Eiro`, NOT `Euro` — bar.wikipedia's own article reads "Da Eiro (amtli: Euro, Symboi: €)".
    [InlineData("11.709 €", "11709 Eiro")]        // postposed, the European order
    [InlineData("$ 45.000", "45000 Dollar")]      // preposed
    [InlineData("£ 795", "795 Pfund")]
    // A compound key, because the tier is letter-bounded on the left so a bare `$` cannot match here.
    [InlineData("US$105&nbsp;Milliona", "105 Milliona Dollar")]
    [InlineData("3757 km", "3757 Kilometa")]      // `km` had read as the vowel-less cluster [km]
    [InlineData("374 m", "374 Meta")]
    // The measure word FUSES onto the front.
    [InlineData("40.000 m³", "40000 KubikMeta")]  // see the capital note above
    [InlineData("2.800 cm³", "2800 KubikZantimeta")]
    public void TheSymbolTier(string input, string want) =>
        Assert.Equal(want, BarNormalize.NormalizeBavarian(input));

    [Fact]
    public void TheExponentCompoundIsTheSameIpaAsTheTidySpelling() =>
        Assert.Equal("fiɐ̯t͡sɡ̥ d̥ɑɔ̯snd̥ kub̥iɡ̥med̥ɐ", Phonemizer.Phonemize("40.000 m³", "bar").Trim());

    [Theory]
    // THE DECIMAL COMMA: `Komma` is attested on bar.wikipedia only as a VERB, so the comma stays a pause
    // rather than becoming a confidently wrong word in the highest-traffic slot.
    [InlineData("10,5 Millionan")]
    // `=` `<` `>` — not one instance in the artifact is arithmetic; they are the dialect wiki's own notation.
    [InlineData("da- (< der-)")]
    [InlineData("Lautwandlregl ei > oa")]
    [InlineData("bei dem = beim")]
    // The ampersand: every one in the Bavarian subset is `&nbsp;`. Folding the entity must not leave the
    // bare sign readable as a word.
    [InlineData("Königshausen & Neumann")]
    public void SourcedRefusalsKeepReadingAsTheyDo(string input) =>
        Assert.Equal(input, BarNormalize.NormalizeBavarian(input));

    // ── #1080 — the bignum fallback must not re-read the float it exists to bypass ────────────────────
    // ⚠ The reading was a confidently WRONG quantity, not a drop — the sentence still scans, so no leak gate
    // and no referee names it, and this golden's longest digit run is far short of the fallback.

    [Fact]
    public void PastTwoToTheFiftyThreeTheLowDigitsAreTheTokens()
    {
        // 9007199254740993 is 2^53+1; as a double it IS 2^53, so re-stringifying reads …992.
        var words = Phonemizer.Phonemize("9007199254740993", "bar").Trim().Split(' ');
        Assert.Equal("d̥rɑɛ̯", words[^1]); // …993, was its neighbour's …992
    }

    [Fact]
    public void AboveOneE21EveryDigitIsStillRead() =>
        Assert.Equal(22, Phonemizer.Phonemize("1000000000000000000000", "bar").Trim().Split(' ').Length);
}
