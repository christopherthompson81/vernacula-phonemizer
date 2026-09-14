/**
 * Commonwealth spelling → the lexicon's spelling, for OOV words.
 * Ported from test/english-spelling-variants.test.ts; the rule evidence is in
 * src/languages/english/spellingVariants.ts.
 *
 * ⚠ THE EXPECTED STRINGS ARE THE TYPESCRIPT'S, VERBATIM. This file is the parity gate for a class
 * of words the 200-row en golden does not contain at all.
 */
using System.Threading.Tasks;
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Languages.English;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class EnglishSpellingVariantsTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "en");

    [Theory]
    [InlineData("vapour", "vˈeᶦpɚ")]
    [InlineData("savour", "sˈeᶦvɚ")]
    [InlineData("vigour", "vˈɪɡɚ")]
    [InlineData("valour", "vˈælɚ")]
    [InlineData("succour", "sˈʌkɚ")]
    [InlineData("watercolour", "wˈɔːt̬ɚkʰˌʌlɚ")]
    [InlineData("behavioural", "bᵻhˈeᶦvjɚəɫ")]
    [InlineData("analyse", "ˈænəlˌaᶦz")]
    [InlineData("organisation", "ˌɔːɹɡənɪzˈeᶦʃən")]
    [InlineData("centre", "sˈɛntɚ")]
    [InlineData("calibre", "kʰˈæləbɚ")]
    [InlineData("defence", "dᵻfˈɛns")]
    [InlineData("travelled", "tɹˈævəɫd")]
    [InlineData("marvellous", "mˈɑːɹvələs")]
    [InlineData("counsellor", "kʰˈaᶷnsəlɚ")]
    [InlineData("unrivalled", "ənɹˈaᶦvəɫd")]
    [InlineData("enrolment", "ɛnɹˈoᶷɫmənt")]
    [InlineData("skilful", "skˈɪɫfəɫ")]
    [InlineData("anaemia", "ənˈiːmiʲə")]
    [InlineData("foetus", "fˈiːt̬əs")]
    [InlineData("oesophagus", "ɪsˈɑːfəɡəs")]
    [InlineData("paediatric", "pʰˌiːd̬iʲˈætɹɪk")]
    [InlineData("manoeuvre", "mənˈuːvɚ")]
    [InlineData("catalogue", "kʰˈæt̬əlˌɔːɡ")]
    [InlineData("programme", "pɹˈoᶷɡɹæm")]
    [InlineData("sulphur", "sˈʌɫfɚ")]
    [InlineData("inflexion", "ɪnflˈɛkʃən")]
    public void ACommonwealthSpellingReadsAsItsLexiconTwin(string word, string ipa)
        => Assert.Equal(ipa, Say(word));

    [Theory]
    [InlineData("flour", "flˈaᶷɚ")]
    [InlineData("scouring", "skˈaᶷɚɪŋ")]
    [InlineData("our", "ˈaᶷɚ")]
    [InlineData("hour", "ˈaᶷɚ")]
    [InlineData("devour", "dᵻvˈaᶷɚ")]
    [InlineData("dolling", "dˈɑːlɪŋ")]
    [InlineData("palled", "pʰˈɑːɫd")]
    [InlineData("tilled", "tʰˈɪɫd")]
    [InlineData("pilled", "pʰˈɪɫd")]
    public void AWordThatOnlyLooksCommonwealthIsLeftAlone(string word, string ipa)
        => Assert.Equal(ipa, Say(word));

    [Fact]
    public void ABlockedFoldReturnsNothingRatherThanGuessing()
        => Assert.Null(SpellingVariants.AmericanSpelling("floury", _ => true));

    [Fact]
    public async Task TheFoldResolvesBeforeTheOovSplitSoSyncAndAsyncAgree()
    {
        foreach (var w in new[] { "vapour", "analyse", "manoeuvre", "counsellor" })
            Assert.Equal(Say(w), await Phonemizer.PhonemizeAsync(w, "en"));
    }

    [Theory]
    [InlineData("vapour", "vˈeᶦpə")]
    [InlineData("manoeuvre", "mənˈuːvə")]
    public void EnGbGetsTheFoldThenItsOwnNonRhoticDelta(string word, string ipa)
        => Assert.Equal(ipa, Phonemizer.Phonemize(word, "en-GB"));

    [Theory]
    [InlineData("aluminium", "aluminum")]
    [InlineData("learnt", "learned")]
    public void PairsThatAreDifferentWordsAreNotFolded(string gb, string us)
        => Assert.NotEqual(Say(gb), Say(us));
}
