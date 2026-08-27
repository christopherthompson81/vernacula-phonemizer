// The portable half of test/serbian.test.ts — the branches the 200-row golden cannot reach: the dual-script
// g2p, the pitch-accent lexicon and its OOV transition tier, each normalize arm, and the >2^53 digit run of
// #1059. ⚠ `PhonemizeWord`/`ForeignLetters` are the surface hr and bs will reuse, so they are exercised
// directly here and not only through `Text`.
using Vernacula.Phonemizer;
using SerbianEngine = Vernacula.Phonemizer.Languages.Serbian.SerbianPhonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SerbianTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "sr").Trim();

    [Theory]
    // Latin: v→ʋ, the alveolo-palatal + palatal series, syllabic r.
    [InlineData("voda", "ʋˈoda")]
    [InlineData("ljubav", "ʎˈuː˩˥baʋ")]
    [InlineData("đak", "d͡ʑaː˥˩k")]
    [InlineData("ćao", "t͡ɕˈaː˥˩o")]
    [InlineData("džep", "d͡ʒe˥˩p")]
    [InlineData("srce", "sˈr˥˩t͡se")]
    // Cyrillic maps to the SAME IPA.
    [InlineData("вода", "ʋˈoda")]
    [InlineData("љубав", "ʎˈuː˩˥baʋ")]
    [InlineData("ђак", "d͡ʑaː˥˩k")]
    [InlineData("срце", "sˈr˥˩t͡se")]
    [InlineData("хвала", "xʋˈaː˩˥la")]
    // Lexical pitch accent: position before the nucleus, contour after it, length on it.
    [InlineData("jezik", "jˈe˩˥zik")]
    [InlineData("beograd", "beˈo˩˥ɡrad")]
    [InlineData("rijeka", "rijˈeː˩˥ka")]
    [InlineData("Србијанка", "srbˈi˩˥janka")]
    // A monosyllable takes no ˈ but DOES take its tone; a two-contour spelling withholds the tone; a clitic
    // gets nothing at all.
    [InlineData("noć", "noː˥˩t͡ɕ")]
    [InlineData("grad", "ɡrad")]
    [InlineData("je", "je")]
    [InlineData("od", "od")]
    // OOV → the first nucleus and no tone, unless the transition tier answers.
    [InlineData("godine", "ɡˈodine")]
    [InlineData("godina", "ɡˈo˥˩dina")]
    [InlineData("sedamdesetih", "sedamdˈe˩˥setix")]
    [InlineData("stepeni", "stˈe˥˩peni")]
    // Ordinary vowel-less words keep their syllabic ⟨r⟩ nucleus and are not degeminated away.
    [InlineData("krv", "krː˥˩ʋ")]
    [InlineData("prst", "pr˥˩st")]
    public void PhonemizeWordReadsWhatItClaims(string word, string want) =>
        Assert.Equal(want, SerbianEngine.PhonemizeWord(word));

    [Fact]
    public void AccentLexiconHasSeparatesMissingDataFromNoAccent()
    {
        Assert.True(SerbianEngine.AccentLexiconHas("jezik"));
        Assert.False(SerbianEngine.AccentLexiconHas("godine"));
        Assert.False(SerbianEngine.AccentLexiconHas("sedamdesetih"));
    }

    // ⟨q w x y th⟩ are outside Gaj's Latin and were DELETED before this fold; ⟨th⟩ has a native-prefix guard.
    [Theory]
    [InlineData("Downing", "Dovning")]
    [InlineData("taxi", "taksi")]
    [InlineData("quiz", "kviz")]
    [InlineData("Exxon", "Ekson")]
    [InlineData("Toyota", "Tojota")]
    [InlineData("Dylana", "Dilana")]
    [InlineData("prethodni", "prethodni")] // pred+hod — [tx] is CORRECT here
    [InlineData("Matthew", "Mattev")]
    public void ForeignLettersFoldsWhatGajsLatinLacks(string word, string want) =>
        Assert.Equal(want, SerbianEngine.ForeignLetters(word));

    [Theory]
    // N. ordinals — the case comes from the licensing word, in either script.
    [InlineData("1624. године", "xˈiʎadu ʃˈeː˥˩ststo dʋˈaː˩˥deset t͡ʃˈetʋrte ɡˈodine")]
    [InlineData("1624. godine", "xˈiʎadu ʃˈeː˥˩ststo dʋˈaː˩˥deset t͡ʃˈetʋrte ɡˈodine")]
    [InlineData("3. августа", "trˈet͡ɕeɡ aʋɡˈusta")] // treći is the one SOFT stem
    // …and an `N.` outside the licensor list keeps its sentence pause.
    [InlineData("типа 1.", "tˈipa jˈe˩˥dan .")]
    [InlineData("1770. Некад", "xˈiʎadu sˈe˥˩damsto sedamdˈe˩˥set . nˈe˥˩kad")]
    // Period-grouped thousands; adjacent groups share a digit, so the de-grouper runs twice.
    [InlineData("1.400 људи", "xˈiʎadu t͡ʃˈe˥˩tiristo ʎˈudi")]
    [InlineData("5.000.000", "peː˥˩t miliˈona")]
    // Count agreement, rates, clock, decimals.
    [InlineData("83 km", "osamdˈe˩˥set triː˥˩ kˈilometra")]
    [InlineData("70 km", "sedamdˈe˩˥set kˈilometara")]
    [InlineData("133 m/s", "stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi")]
    [InlineData("480 km/h", "t͡ʃˈe˥˩tiristo osamdˈe˩˥set kˈilometara na saː˥˩t")]
    [InlineData("11:00", "jedˈa˩˥naest sˈati")]
    [InlineData("5:3", "peː˥˩t , triː˥˩")] // a SCORE — one-digit minutes are not a clock
    [InlineData("1,5 сати", "jˈe˩˥dan zˈarez peː˥˩t sˈati")]
    // Degrees: the scale arm, the bare arm, and the bearings that must stay attached.
    [InlineData("32 °C степена", "trˈiː˩˥deset dʋaː˥˩ stˈepena t͡sˈelzijusa")]
    [InlineData("35°W", "trˈiː˩˥deset peː˥˩t stˈe˥˩peni")]
    [InlineData("35 stepeni", "trˈiː˩˥deset peː˥˩t stˈe˥˩peni")]
    // Numeral + hyphen + case suffix, written in Cyrillic on a Latin-emitted ordinal.
    [InlineData("1970-их", "xˈiʎadu dˈe˥˩ʋetsto sedamdˈe˩˥setix")]
    [InlineData("11-годишња", "jedˈa˩˥naest ɡˈodiʃɲa")] // a COMPOUND adjective — deliberately not claimed
    // The era marker, and its final dot doubling as the sentence end.
    [InlineData("323. године п. н. е.", "trˈi˥˩sta dʋˈaː˩˥deset trˈet͡ɕe ɡˈodine pre˥˩ nˈoʋe ˈere .")]
    [InlineData("Око 1000. п. н. е. Асирци", "ˈo˥˩ko xˈiʎadite pre˥˩ nˈoʋe ˈere . asˈiː˩˥rt͡si")]
    // ⚠ AND THE CE MARKER, which the arm used to leave out — the year then took the CARDINAL and kept its
    // ordinal dot, so the tokenizer read a phrase break in the middle of a date. Same construction, only the
    // negation differs. sr's own 4 era instances are all BCE; the CE attestation is hr's, which this core
    // now serves. See the TS docstring.
    [InlineData("Око 1000. н. е. Асирци", "ˈo˥˩ko xˈiʎadite nˈoʋe ˈere . asˈiː˩˥rt͡si")]
    [InlineData("Око 1000. н.е.", "ˈo˥˩ko xˈiʎadite nˈoʋe ˈere .")]
    [InlineData("1300. n. e.", "xˈiʎadu tristˈote nˈoʋe ˈere .")]
    // ⚠ AND LOWERCASE-ONLY. `н.е.` / `n.e.` is also two INITIALS with stops, and the rule was
    // case-insensitive — `N. E. Kovač` read *nˈoʋe ˈere . kˈoʋat͡ʃ*. All eight era instances across the sr
    // and hr corpora are lowercase; initials are capitals. They now read as letter names instead.
    [InlineData("N. E. Kovač", "en e kˈo˩˥ʋat͡ʃ")]
    // ⚠ …and kmr's digit-adjacency guard would NOT have worked here: this instance spells the century as a
    // WORD, with no digit near the marker, and it must keep firing.
    [InlineData("веку п.н.е, једна", "ʋˈeku pre˥˩ nˈoʋe ˈere , jednˈa")]
    // Dotted abbreviations, in both scripts; `)` is not a pause, so the dot stays.
    [InlineData("прича, итд.)", "prˈiː˥˩t͡ʃa , i tˈa˩˥ko dˈa˥˩ʎe .")]
    [InlineData("npr. ovo", "na prˈiː˩˥mer ˈo˩˥ʋo")]
    // Initialisms, both scripts, on the Serbo-Croatian letter names.
    [InlineData("СССР", "es es es er")]
    [InlineData("GMT", "ɡe em te")]
    [InlineData("НАТО", "nˈato")] // a pronounceable acronym is a word
    // Numbers: gender agreement on the FEMININE hiljada, and the masculine milion.
    [InlineData("2000", "dʋeː˥˩ xˈiʎade")]
    [InlineData("21000", "dʋˈaː˩˥deset jednˈa xˈiʎada")]
    [InlineData("2000000", "dʋaː˥˩ miliˈona")]
    public void TextRewritesWhatItClaims(string input, string want) => Assert.Equal(want, Say(input));

    // #1059: `serbian.ts`'s number call site never passed the token string, so above 1e21 the digits came
    // from the double's exponent form and both probes read *jˈe˩˥dan e dʋaː˥˩ jˈe˩˥dan*.
    [Fact]
    public void A22DigitRunKeepsItsOwnDigits()
    {
        var a = Say("1000000000000000000001");
        var b = Say("1000000000000000000009");
        Assert.NotEqual(a, b);
        Assert.EndsWith("jˈe˩˥dan", a, StringComparison.Ordinal);
        Assert.EndsWith("dˈe˥˩ʋet", b, StringComparison.Ordinal);
        Assert.Equal(22, a.Split(' ').Length);
        // Above 2^53 the double has already rounded, so the digits must come from the token.
        Assert.EndsWith("triː˥˩", Say("9007199254740993"), StringComparison.Ordinal);
    }
}
