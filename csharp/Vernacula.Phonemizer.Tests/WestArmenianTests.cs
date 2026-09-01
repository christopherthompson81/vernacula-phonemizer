/**
 * The portable half of test/westarmenian.test.ts — WESTERN Armenian (hyw), արեւմտահայերէն, the
 * Istanbul/diaspora standard. The signature is the CONSONANT SHIFT: the classical three-way
 * stop/affricate system collapses to a two-way one — classical VOICED and classical ASPIRATE both →
 * voiceless-aspirated, while classical VOICELESS → VOICED. Referee: wikipron hye_armn_w broad + narrow.
 *
 * The engine is SHARED with Eastern Armenian (Armenian.cs `MakeArmenianEngine`); everything specific to
 * this standard is data in westarmenian.jsonc plus the sibling normalization layer.
 *
 * Every expected value is the TypeScript engine's own output.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.WestArmenian;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class WestArmenianTests
{
    private static string Word(string s) => WestArmenianPhonemizer.PhonemizeWord(s);
    private static string Say(string s) => Phonemizer.Phonemize(s, "hyw");
    private static string Norm(string s) => Normalize.NormalizeWestArmenian(s);

    [Theory]
    // THE CONSONANT SHIFT — classical voiceless ⟨պ տ կ⟩ → VOICED [b d ɡ].
    [InlineData("պատ", "bɑd")] // 'wall' — ⟨պ⟩→[b], final ⟨տ⟩→[d]
    [InlineData("տուն", "dun")] // 'house' — ⟨տ⟩→[d]
    [InlineData("կով", "ɡov")] // 'cow' — ⟨կ⟩→[ɡ]
    [InlineData("ծառ", "d͡zɑɾ")] // 'tree' — ⟨ծ⟩→[d͡z]
    [InlineData("ճամբա", "d͡ʒɑmpʰɑ")] // 'road' — ⟨ճ⟩→[d͡ʒ], and ⟨բ⟩→[pʰ]
    public void ShiftVoicelessBecomesVoiced(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // THE CONSONANT SHIFT — classical voiced ⟨բ դ գ⟩ → voiceless-ASPIRATED [pʰ tʰ kʰ].
    [InlineData("բարի", "pʰɑɾi")] // 'kind' — ⟨բ⟩→[pʰ]
    [InlineData("դուռ", "tʰuɾ")] // 'door' — ⟨դ⟩→[tʰ], and ⟨ռ⟩→[ɾ] (neutralised)
    [InlineData("գործ", "kʰoɾd͡z")] // 'work' — ⟨գ⟩→[kʰ], ⟨ծ⟩→[d͡z]
    [InlineData("ձուկ", "t͡sʰuɡ")] // 'fish' — ⟨ձ⟩→[t͡sʰ], ⟨կ⟩→[ɡ]
    [InlineData("ջուր", "t͡ʃʰuɾ")] // 'water' — ⟨ջ⟩→[t͡ʃʰ]
    public void ShiftVoicedBecomesAspirated(string word, string want) => Assert.Equal(want, Word(word));

    [Theory]
    // classical aspirate ⟨փ թ ք⟩ stay [pʰ tʰ kʰ] — MERGING with the shifted voiced column.
    [InlineData("փակ", "pʰɑɡ")] // ⟨փ⟩→[pʰ] (= ⟨բ⟩), ⟨կ⟩→[ɡ]
    [InlineData("թութ", "tʰutʰ")] // ⟨թ⟩→[tʰ] (= ⟨դ⟩)
    [InlineData("քար", "kʰɑɾ")] // ⟨ք⟩→[kʰ] (= ⟨գ⟩)
    public void AspiratesMergeWithTheShiftedColumn(string word, string want) =>
        Assert.Equal(want, Word(word));

    [Theory]
    // shared features + the front-rounded ⟨յու⟩→[ʏ] is POST-CONSONANT ONLY.
    [InlineData("Երևան", "jeɾevɑn")] // word-initial ⟨ե⟩→[je]; ligature ⟨և⟩→[ev]
    [InlineData("Առյուծ", "ɑɾʏd͡z")] // C+⟨յու⟩→[ʏ] front-rounded (after ⟨ռ⟩); ⟨ծ⟩→[d͡z]
    [InlineData("Հարություն", "hɑɾutʰʏn")] // C+⟨յու⟩→[ʏ] (the -ություն suffix, after ⟨թ⟩)
    [InlineData("յոթ", "jotʰ")] // 'seven' — word-initial ⟨յո⟩ is the GLIDE [jo], NOT [œ]
    [InlineData("յուղ", "juʁ")] // 'oil' — word-initial ⟨յու⟩ is the GLIDE [ju], NOT [ʏ]
    public void SharedFeaturesAndTheFrontRounded(string word, string want) =>
        Assert.Equal(want, Word(word));

    [Fact]
    // the same word diverges from EASTERN precisely on the stop series.
    public void TheDivergenceFromEasternIsTheStopSeries()
    {
        Assert.Equal("bɑd", Word("պատ"));                                        // Western
        Assert.Equal("pɑt", Languages.Armenian.Armenian.PhonemizeWord("պատ"));   // Eastern — mirror-imaged
        Assert.Equal("pʰɑɾi", Word("բարի"));                                     // Western
        Assert.Equal("bɑɾi", Languages.Armenian.Armenian.PhonemizeWord("բարի")); // Eastern
    }

    [Fact]
    // THE SEVEN THINGS THAT DID NOT TRANSFER FROM EASTERN — each measured on hyw.wikipedia.
    public void TheSevenThingsThatDidNotTransfer()
    {
        // The classical ⟨թ⟩ in the measure words — մեթր x60, քիլոմեթր x49.
        Assert.Equal(Say("36 քիլոմեթր"), Say("36 կմ"));
        Assert.Equal(Say("330 մեթր"), Say("330 մ"));
        // տոլար x48, not Eastern's դոլար; եւրօ x62, not եվրո.
        Assert.Equal(Say("25 տոլար"), Say("$25"));
        Assert.Equal(Say("25 եւրօ"), Say("€25"));
        // ⚠ THE SCALE COMPOUND IS «սելսիուս աստիճան» — scale FIRST and no genitive, where Eastern writes
        // «Ցելսիուսի աստիճան».
        Assert.Equal(Say("20 սելսիուս աստիճան"), Say("20 °C"));
        // ⚠ THE CASE SUFFIX IS LOWERCASE-ONLY AND MUST STAY SO. Making the scale letter case-insensitive
        // with an `i` flag folds this language's suffix class too, so an UPPERCASE run after the hyphen
        // starts being captured as a suffix. The scale letter goes in the character class instead.
        Assert.Equal(Say("20 °C"), Say("20 °c"));            // lowercase scale letter
        Assert.Equal(Say("20 աստիճանը"), Say("20 °-ը"));      // lowercase suffix IS absorbed
        Assert.NotEqual(Say("20 աստիճանԸ"), Say("20 °-Ը"));   // uppercase is NOT a suffix
        // ⚠ AND THE OBLIQUE "TWO" IS երկուք-, not Eastern's երկուս-.
        Assert.Equal("երկրորդ", Normalize.OrdinalWords(2));
        Assert.Equal("քսան երկուքին", Norm("22-ին"));
    }

    [Theory]
    // The normalization layer, whose evidence is tools/corpus/mined/hyw.jsonc (140,044 segments) and
    // whose argument is in the TS header.
    [InlineData("22-ին", "քսան երկուքին")] // ⚠ the oblique TWO is երկուք-, not Eastern's երկուս- (×17 against ×1)
    [InlineData("Ք.Ա. 8-րդ", "Քրիստոսէ առաջ ութերորդ")]
    [InlineData("մ.թ.ա. 85", "մեր թուարկութենէն առաջ 85")] // ⚠ the LONGER era form must be tried first
    [InlineData("մ.թ. 694", "մեր թուարկութեամբ 694")]
    [InlineData("5.23 ա.մ.", "5 ամբողջ 23 աստղագիտական միաւոր")] // the corpus's own self-gloss
    [InlineData("2019-ին", "երկու հազար տասնինին")]
    [InlineData("2029-ի", "երկու հազար քսան ինի")]
    [InlineData("3-րորդ", "երրորդ")] // the fuller suffix spelling
    [InlineData("8-րդ դարէն", "ութերորդ դարէն")]
    [InlineData("1960-ականներուն", "հազար իննհարիւր վաթսունականներուն")]
    [InlineData("1915-1923", "1915, 1923")] // ⚠ a RANGE must not be claimed — the suffix rule needs a LETTER
    [InlineData("5,87", "5 ամբողջ 87")]
    [InlineData("5.87", "5 ամբողջ 87")] // …BOTH marks are the decimal here
    [InlineData("1 377 808", "1377808")] // space-grouped
    [InlineData("445,000", "445000")] // …and a comma with exactly 3 digits is GROUPING
    [InlineData("0.037", "0 ամբողջ զրօ 37")] // ⚠ a leading zero is a silent 10x error otherwise (trap 56)
    [InlineData("100=47", "100 հաւասար 47")] // ⚠ the counter-example to trap 62 — here `=` really is an equals
    [InlineData("ρ =1260", "ρ =1260")] // …but the rule stays DIGIT-GATED
    [InlineData("3800±200", "3800, 200")] // a tolerance
    [InlineData("0.96÷1.41", "0 ամբողջ 96, 1 ամբողջ 41")] // ⚠ the divide sign is a RANGE here
    [InlineData("735-714:", "735, 714:")] // ⚠ nothing may be required after the second number (trap 58)
    public void TextNormalization(string input, string want) => Assert.Equal(want, Norm(input));

    [Theory]
    // ՛ ՜ ՞ sit INSIDE the word, and hyw must not break it either. The rule that undoes them was written
    // as Eastern's normalize step 0, but the word they split is split by the SHARED tokenizer — so it
    // belongs to the engine. ⚠ Zero of them are in the parity golden: this is differential evidence.
    [InlineData("կա՛մ", "ɡɑm")] // was `ɡɑ mə`
    [InlineData("ո՛չ", "vot͡ʃʰ")] // was `vo t͡ʃʰə` — the ո→vo glide fired on a one-letter fragment
    [InlineData("Տե՛ս", "des")] // was `de sə`
    [InlineData("Ա՜խ", "ɑχ")] // was `ɑ χə`
    [InlineData("Ինչո՞ւ", "int͡ʃʰu ?")] // was `int͡ʃʰo ? və` — the ⟨ու⟩ digraph split as well
    [InlineData("Ինչպէ՞ս", "int͡ʃʰbes ?")] // was `int͡ʃʰbe ? sə`
    [InlineData("կ՛երթան", "ɡeɾtʰɑn")] // the կը proclitic before a vowel-initial stem — an ELISION mark
    [InlineData("կ՛աւերուին", "ɡɑveɾuin")] // …the prefix FUSES with the stem, so joining is right for it too
    public void TheOverTheVowelMarksDoNotSplitTheWord(string word, string want) =>
        Assert.Equal(want, Say(word));

    [Fact]
    public void TheProcliticFusesInASentence() =>
        Assert.Equal("ɑmen oɾ ɡeɾtʰɑn .", Say("Ամէն օր կ՛երթան։"));
}
