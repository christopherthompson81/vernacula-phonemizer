/**
 * Paraguayan Guaraní (gn) — Avañe'ẽ, Tupian, co-official in Paraguay.
 * Signatures: the 12-vowel system (⟨y⟩→[ɨ] + six NASAL vowels ⟨ã ẽ ĩ õ ũ ỹ⟩), the PRENASALIZED voiced
 * stops ⟨mb nd⟩→[ᵐb ⁿd] (⟨ng⟩ is always [ŋ]), the glottal ⟨'⟩ (puso)→[ʔ], ⟨ch⟩→[ʃ], ⟨j⟩→[d͡ʒ],
 * ⟨g⟩→[ɰ] / ⟨gu⟩→[w], ⟨ñ⟩→[ɲ]; glide formation (prevocalic i→j, u→w); default final-syllable (oxytone)
 * stress, overridden by an acute or drawn to a nasal vowel.
 *
 * The portable half of test/guarani.test.ts. Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.Guarani;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class GuaraniTests
{
    private static string Word(string s) => GuaraniPhonemizer.PhonemizeWord(s);
    private static string Text(string s) => Registry.GetPhonemizer("gn").Text(s).Trim();
    private static string Norm(string s) => Normalize.NormalizeGuarani(s);

    [Theory]
    [InlineData("y", "ˈɨ")]                          // 'water' — ⟨y⟩ is the high central vowel [ɨ]
    [InlineData("avañe'ẽ", "aʋaɲeˈʔẽ")]              // 'Guaraní language' — ñ→ɲ, ⟨'⟩→ʔ, nasal ẽ
    [InlineData("mba'e", "ᵐbaˈʔe")]                   // 'thing' — prenasalized ⟨mb⟩ + puso
    [InlineData("tetã", "teˈtã")]                     // 'country' — nasal vowel ã
    public void TwelveVowelsAndThePuso(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("ñande", "ɲaˈⁿde")]                   // 'our (incl.)' — ñ→ɲ, prenasalized ⟨nd⟩
    [InlineData("che", "ˈʃe")]                        // 'I/my' — ⟨ch⟩→ʃ
    [InlineData("kuñatãi", "kuɲaˈtãi")]               // 'young woman' — nasal ã attracts stress
    public void PrenasalizedStopsChNyAndNasalStress(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("guata", "waˈta")]                    // 'to walk' — ⟨gu⟩ before a back vowel → [w]
    [InlineData("jagua", "d͡ʒaˈwa")]                   // 'dog' — ⟨j⟩→d͡ʒ, ⟨gu⟩→w
    [InlineData("Paraguay", "paɾawaˈɨ")]              // ⟨gu⟩→w, final ⟨y⟩→ɨ
    public void GGuJAndGlideFormation(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    [Theory]
    [InlineData("mbo'ehára", "ᵐboʔeˈhaɾa")]           // 'teacher' — á accent → stress on ⟨há⟩ (not final)
    [InlineData("kuéra", "ˈkweɾa")]                   // plural — ⟨ku⟩→[kw] is one onset, stress before the whole cluster
    [InlineData("guyra", "ɰɨˈɾa")]                    // 'bird' — ⟨gu⟩ before the central ⟨y⟩ → [ɰ]
    [InlineData("avañe’ẽ", "aʋaɲeˈʔẽ")]               // curly apostrophe ’ (U+2019) → the glottal [ʔ]
    public void AcuteStressCglideOnsetAndCurlyPuso(string input, string expected) =>
        Assert.Equal(expected, Word(input));

    // ── CARDINAL NUMBERS — the 20th-century NEOLOGISM system (Decoud Larrosa; Estigarribia 2020 §3.4.3).
    // ⚠ THIS READS AS THE WRITTEN/ACADEMIC REGISTER BY DESIGN — the only numerals attested in Guaraní
    // orthography; a Spanish-loan path would mean inventing respellings.

    [Theory]
    [InlineData("0", "ᵐbaʔeˈʋe")]                     // mba'eve 'nothing'
    [InlineData("4", "iɾuˈⁿdɨ")]                      // irundy — the last PRE-CONTACT numeral
    [InlineData("6", "poteˈĩ")]                       // poteĩ = po 'hand' + teĩ (apheresised peteĩ)
    [InlineData("11", "pateˈĩ")]                      // pateĩ = pa + teĩ, FUSED
    [InlineData("13", "paʔaˈpɨ")]                     // pa'apy = pa + 'apy (apheresised mbohapy)
    [InlineData("21", "moˈkõipa peteˈĩ")]             // mokõipa peteĩ — tens FUSED, then a SPACE
    public void CardinalsNativeAndNeologisms(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    [Theory]
    [InlineData("100", "ˈsa")]                        // sa (< rasa) — never *peteĩsa
    [InlineData("101", "ˈsa peteˈĩ")]
    [InlineData("234", "moˈkõisa ᵐbohapɨˈpa iɾuˈⁿdɨ")] // mokõisa mbohapypa irundy
    [InlineData("1000", "ˈsu")]                       // su (< guasu)
    [InlineData("10000", "paˈsu")]                    // pasu = pa × su
    [InlineData("1000000", "ˈswa")]                   // sua
    [InlineData("10000000", "paˈswa")]                // pasua = pa × sua — from the grammar's table
    public void ScaleWordsMultiplicativeOneDropped(string input, string expected) =>
        Assert.Equal(expected, Text(input));

    // ── TEXT NORMALIZATION (Normalize.cs) ──────────────────────────────────────────────────────────────

    /**
     * THE PUSO'S THREE GLYPHS. The saltillo ⟨ꞌ⟩ U+A78C is ×301 in the corpus and was SILENTLY DELETED;
     * U+02BC is the mirror failure — the tokenizer split the word before the scan could fold it. Both
     * must reach the same IPA as the ASCII apostrophe.
     */
    [Fact]
    public void ThePusoGlyphsReachTheSameGlottalStop()
    {
        var want = Text("mba'e");
        Assert.Equal("ᵐbaˈʔe", want);
        foreach (var v in new[] { "mba’e", "mbaꞌe", "mbaʼe" })
            Assert.Equal(want, Text(v)); // U+2019, U+A78C, U+02BC
        Assert.Equal("ɲeˈʔẽ", Text("ñeꞌẽ"));         // 'language/word'
        Assert.Equal("ᵐboʔeˈhaɾa", Text("Mboꞌehára")); // 'teacher' — puso AND an acute
        // ⚠ U+02BC is the one that proves the fix belongs ABOVE the tokenizer: unfolded it SPLIT the word.
        Assert.Single(Text("ñeʼẽ").Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /** A zero-width space split a word in two; the Spanish ordinal indicator ⟨º⟩ read as the EMPTY STRING. */
    [Fact]
    public void ZeroWidthSpaceAndTheOrdinalIndicator()
    {
        Assert.Single(Text("ñe'ẽ\u200bme").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        Assert.Equal("1", Norm("1º"));
        Assert.Equal("15.", Norm("15.º"));
        // ⚠ AND ⟨º⟩ STANDING IN FOR THE DEGREE SIGN IS A DIFFERENT BRANCH — it must fold, not be deleted.
        Assert.Equal("21 Celsius", Norm("21º C"));
        Assert.Equal("40 Celsius", Norm("40ª C"));
    }

    /** A coordinate's `'` after digits is not a puso: after the fold it is indistinguishable from the
     *  glottal stop, and reading it would invent a phoneme. The coordinate itself is refused. */
    [Fact]
    public void PrimeAfterDigitsIsDroppedNotRead()
    {
        Assert.DoesNotContain("ʔ", Text("25° 15'"));
        Assert.Equal("22°00", Norm("22°00´"));
        // ⚠ THE ADVERSARIAL NEIGHBOUR: an ordinary intra-word puesto must be untouched by that rule.
        Assert.Equal("ᵐbaˈʔe", Text("mba'e"));
    }

    /** De-grouping — the biggest defect the layer repairs. Three conventions at once: period, space and
     *  the `&nbsp;` the entity decoder turns into a space. */
    [Fact]
    public void ThousandsSeparatorsAllDeGroup()
    {
        Assert.Equal("1098581", Norm("1.098.581"));
        Assert.Equal("12169501", Norm("12 169 501"));
        Assert.Equal("21696", Norm("21 696"));
        Assert.Equal("755838,7", Norm("755.838,7")); // a group followed by its own decimal comma
        Assert.Equal("ˈsu ᵐbohapɨˈsa moˈkõipa iɾuˈⁿdɨ miˈlimetɾo", Text("1.324 mm")); // 1324 mm
    }

    /** ⚠ THE BRANCH THE CORPUS BARELY EXERCISES, and the one guard that separates grouping from a
     *  decimal: an integer part beginning with `0`. `0.572` is a decimal and must NOT become `0572`. */
    [Fact]
    public void LeadingZeroRefusesDeGrouping()
    {
        Assert.Equal("0,572", Norm("0.572"));
        Assert.Equal("1324", Norm("1.324"));
        Assert.Equal("430,9", Norm("430.9")); // fewer than three fractional digits: never a group
    }

    /** ⚠ NO DECIMAL WORD IS DECLARED — written Guaraní never spells one out, and `kyguái` is the name of
     *  the mark, not a reading between operands. What the rule does is stop a decimal PERIOD from reading
     *  as a sentence end, so both conventions fall out alike. */
    [Fact]
    public void DecimalReadsAsAPauseNeverAWord()
    {
        foreach (var s in new[] { "8,70 %", "3.61%" })
        {
            Assert.DoesNotContain("kɨwaˈi", Text(s)); // no kyguái
            Assert.DoesNotContain("ˈkɨta", Text(s));  // no kyta
        }
        Assert.Equal("ᵐbohaˈpɨ , poteˈĩpa peteˈĩ ˈpoɾ kjeˈⁿto", Text("3.61%"));
    }

    /** THE ORDINAL SUFFIX, and this is trap 14: a digit becomes words in the TOKENIZER, so the operand is
     *  converted to words inside the rule and the suffix attached to the LAST of them. */
    [Fact]
    public void OrdinalAttachedToTheWordedCardinal()
    {
        Assert.Equal("pakõiha", Norm("12ha"));                  // 12 → pakõi → pakõiha
        Assert.Equal("mokõiha", Norm("2ha"));                   // the table branch
        Assert.Equal("mokõipa peteĩha", Norm("21ha"));          // the compositional branch
        Assert.Equal("saha", Norm("100ha"));                    // the scale branch, ONE dropped
        Assert.Equal("paˈkõiha", Text("12ha"));
    }

    /** ⚠ THE RIGHT CONTEXT IS THE DISCRIMINATOR (trap 24): an ordinal is never immediately followed by a
     *  bare number, and that is what declines the coordinator written tight against a year. */
    [Fact]
    public void NhafollowedByABareNumberIsTheConjunction()
    {
        Assert.Equal("1932ha 1934", Norm("1932ha 1934"));
        Assert.Equal("pakõiha producto", Norm("12ha producto"));
    }

    /** The shared tier. Every word here is attested in the slot; `sua` is the engine's own scale word. */
    [Fact]
    public void UnitsSquaredCurrencyAndPercent()
    {
        Assert.Equal("ˈpo kiˈlometɾo", Text("5 km"));
        Assert.Contains("miˈlimetɾo", Text("1.540 milímetro")); // already spelled: not doubled
        Assert.Equal("moˈkõipa poˈkõi kiˈlometɾo kwadɾaˈdo", Text("27 km²"));
        Assert.Equal("moˈkõipa poˈkõi kiˈlometɾo kwadɾaˈdo", Text("27 km2")); // the ASCII exponent too
        Assert.Equal("peteˈĩ metˈɾo ˈkubiko", Text("1 m³"));
        Assert.Equal("poteˈĩpa poˈsu ˈdolaɾ", Text("$65.000")); // 65000 dollars, de-grouped first
        Assert.Equal("ˈsa moˈkõipa peteˈĩ ˈdolaɾ", Text("US$ 121")); // the compound key
        Assert.Equal("poˈpa ˈpoɾ kjeˈⁿto", Text("50%"));
        Assert.Equal("iɾuⁿdɨˈpa iɾuˈⁿdɨ ˈswa kiˈlometɾo kwadɾaˈdo", Text("44 sua km²")); // magnitude hop
    }

    /** ⚠ THE REFUSAL THAT MATTERS MOST IN THIS LANGUAGE. `ha` after a number is ×30 in the corpus and
     *  every one is the coordinator or the ordinal — ZERO hectares — so `ha` is not a unit key. */
    [Fact]
    public void HaIsNeverTheHectare()
    {
        var r = Text("70 ha 80% rupi");
        Assert.Equal("poˈkõipa ˈha poapɨˈpa ˈpoɾ kjeˈⁿto ɾuˈpi", r); // "70 AND 80 percent"
        Assert.DoesNotContain("hekˈtaɾea", r);
        Assert.Equal("1400 ha 1600 milímetro", Norm("1.400 ha 1.600 milímetro"));
    }

    /** TEMPERATURE — the SCALE name only: the degree word has no attested reading in this sense, so this
     *  deliberately under-reads rather than invents. A bare ° is a date, not a temperature. */
    [Fact]
    public void TemperatureScaleNameOnly()
    {
        Assert.Equal("ᵐbohapɨˈpa poɾuˈⁿdɨ kelˈsjus", Text("39°C"));
        Assert.Equal("moˈkõipa ᵐbohaˈpɨ kelˈsjus", Text("23 °C"));
        Assert.Equal("100 Fahrenheit", Norm("100°F"));
        Assert.Equal("1° jasypápe", Norm("1° jasypápe"));
    }

    /** YEAR SPANS take the corpus's own frame `guive … peve`, which it writes out between digits itself.
     *  Both are POSTPOSITIONS taking one operand each, so the infix position is grammatical. */
    [Fact]
    public void FourDigitYearSpansTakeGuivePeve()
    {
        Assert.Equal("1816 guive 1828 peve", Norm("1816-1828"));
        Assert.Equal("1864 guive 1870 peve", Norm("1864–1870")); // en dash too
    }

    /** ⚠ A SPAN THAT ENDS THE CLAUSE IS STILL A SPAN (trap 58) — pinned here, because this corpus has no
     *  clause-final four-digit pair; the trailing guard is `[.,]\d`, not a bare `[.,]`. */
    [Fact]
    public void ClauseFinalYearSpanKeepsJoinerAndPause()
    {
        Assert.Equal("1816 guive 1828 peve.", Norm("1816-1828."));
        Assert.Equal("1932 guive 1935 peve, oiko", Norm("1932-1935, oiko"));
        // the separator-plus-digit half is what still refuses `12-14.000`
        Assert.Equal("12-14000 ary", Norm("12-14.000 ary"));
        // the cap refuses the Spanish page range and the ISBN tail even at a clause end
        Assert.Equal("20: 169-180.", Norm("20: 169-180."));
        Assert.Equal("ISBN: 99925-68-04-06.", Norm("ISBN: 99925-68-04-06."));
    }

    /** ⚠ THE MEASURED REFUSALS. Of 28 hyphen-joined digit pairs in the retained text only 9 are spans; the
     *  four-digit cap and the hyphen-chain guard refuse the other 19. 9 fixed, 0 broken. */
    [Fact]
    public void IsbnsPageRangesAndPhonesAreNotSpans()
    {
        Assert.Equal("ISBN: 99925-68-04-06", Norm("ISBN: 99925-68-04-06"));
        Assert.Equal("978-84-206-2566-9", Norm("978-84-206-2566-9"));
        Assert.Equal("20: 169-180", Norm("20: 169-180")); // a Spanish journal citation
        Assert.Equal("ary 1907-24 jasypateĩ", Norm("ary 1907-24 jasypateĩ")); // two dates
    }

    /** THE CLOCK, and the narrowness is the whole measurement (trap 55): the cell regex matches section
     *  numbers and two-digit decimals far more often than times, so only the colon form, on the hour. */
    [Fact]
    public void ClockOnTheHourOnlyNeverDotForm()
    {
        Assert.Equal("pateˈĩ aɾaˈʋo", Text("11:00"));
        Assert.Equal("16 aravo", Norm("16:00"));
        Assert.Equal("1:15", Norm("1:15"));               // a non-zero minute is refused whole
        Assert.Equal("3.4.10.", Norm("3.4.10."));         // a section number is NOT a clock
        Assert.Equal("3,61 por ciento", Norm("3.61%"));   // nor is a two-digit decimal
        // ⚠ AND IT MUST NOT DOUBLE A NOUN THE TEXT ALREADY WROTE (trap 12).
        Assert.Equal("12:00 aravo", Norm("12:00 aravo"));
    }

    /** ⚠ ORDINARY TEXT MUST SURVIVE. Every rule above matches on shapes that Guaraní words also contain
     *  (`ha`, `-ha`, an apostrophe, a period). */
    [Fact]
    public void OrdinaryProseIsUntouched()
    {
        foreach (var s in new[]
        {
            "Avañe'ẽ ha karaiñe'ẽ ha'e Paraguái retãme ñe'ẽ tee.",
            "Ko táva pe oiko heta tapicha ha oguereko mbo'ehao.",
            "Ñe'ẽ peteĩha ha'e jueheguaty réra ha mokõiha ha'e peteĩ juehegua.",
        })
            Assert.Equal(s, Norm(s));
    }

    [Fact]
    public void RegistryWiring() => Assert.Equal("ɲaˈⁿde", Phonemizer.Phonemize("ñande", "gn").Trim());

    /**
     * ⚠ THE `?? d` IN `readDigits`, WHICH THE PORT DROPPED AND NOTHING SAW. The TypeScript is
     * `UNITS[Number(d)] ?? d`: JS array indexing turns NaN, a negative, a fraction or an out-of-range
     * value into `undefined`, and the `??` passes the CHARACTER THROUGH. The C# read
     * `UNITS[(int)Js.Number(d)]`, and `(int)NaN` is 0 — so EVERY non-digit character came back as
     * `mba'eve`, the word for ZERO. Not a different reading: a quantity invented out of a character that
     * carries none.
     *
     * Reachable through the public API rather than only in theory: `numberToWords(n)` with no `raw` reads
     * `String(n)`, which for n ≥ 1e21 is EXPONENT form — so `1e+21` was read as though the `e` and the `+`
     * were both zeros.
     *
     * ⚠ AND WHITESPACE MUST STILL READ AS ZERO, because JS `Number(" ")` is 0, not NaN. That arm is
     * asserted too — the two engines have to agree on the odd cases as well as the sensible ones.
     */
    [Theory]
    [InlineData("1e+21", "peteĩ e + mokõi peteĩ")]   // the exponent form String(n) produces
    [InlineData("-5", "- po")]
    [InlineData("a", "a")]
    [InlineData("٣", "٣")]                            // a non-ASCII digit is NOT a Guaraní numeral
    [InlineData("😀", "😀")]
    [InlineData("0x10", "mba'eve x peteĩ mba'eve")]
    [InlineData(" ", "mba'eve")]                      // JS Number(" ") is 0 — whitespace DOES index
    [InlineData("1 2", "peteĩ mba'eve mokõi")]
    [InlineData("", "")]
    public void ReadDigitsPassesANonDigitThroughInsteadOfInventingAZero(string input, string want) =>
        Assert.Equal(want, Numbers.ReadDigits(input));

    [Fact]
    // …and the whole path, from the number rather than from a raw token.
    public void AboveOneETwentyOneTheExponentFormIsReadCharacterByCharacter() =>
        Assert.Equal("peteĩ e + mokõi peteĩ", Numbers.NumberToWords(1e21));
}
