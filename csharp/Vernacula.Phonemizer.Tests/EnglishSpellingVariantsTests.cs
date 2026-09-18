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
    [InlineData("analyse", "ˈænə̆lˌaᶦz")]
    [InlineData("organisation", "ˌɔːɹɡənɪzˈeᶦʃən")]
    [InlineData("centre", "sˈɛntɚ")]
    [InlineData("calibre", "kʰˈæləbɚ")]
    [InlineData("defence", "dᵻfˈɛns")]
    [InlineData("travelled", "tɹˈævəɫd")]
    [InlineData("marvellous", "mˈɑːɹvə̆ləs")]
    [InlineData("counsellor", "kʰˈaᶷnsə̆lɚ")]
    [InlineData("unrivalled", "ənɹˈaᶦvəɫd")]
    // ⚠ `ɪn-`, not `ɛn-`: the unstressed prefix was corrected in #1334 (misaki gold, and our own dict
    // could not have `embark` EH0 beside `embarks` IH0). The vowel is incidental to what this line pins —
    // that `enrolment` folds to the `enrollment` row.
    [InlineData("enrolment", "ɪnɹˈoᶷɫmənt")]
    [InlineData("skilful", "skˈɪɫfɫ̩")]
    [InlineData("anaemia", "ənˈiːmiʲə")]
    [InlineData("foetus", "fˈiːt̬əs")]
    [InlineData("oesophagus", "ɪsˈɑːfəɡəs")]
    [InlineData("paediatric", "pʰˌiːd̬iʲˈætɹɪk")]
    [InlineData("manoeuvre", "mənˈuːvɚ")]
    [InlineData("catalogue", "kʰˈæt̬ə̆lˌɔːɡ")]
    [InlineData("programme", "pɹˈoᶷɡɹˌæm")]
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
    // ⚠ `ɔː` not `ɑː`: `palled` is OOV and decodes from `pall`, whose row #1334 corrected AA1 → AO1 (a
    // pall is /pɔːl/). What this line pins is unaffected — the doubled ⟨ll⟩ blocks the Commonwealth fold,
    // so it is not read as `paled` pʰˈeᶦɫd.
    [InlineData("palled", "pʰˈɔːɫd")]
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

    [Theory]
    [InlineData("vapour", "vepa")]
    // ⚠ analaiz, NOT anălaiz. The breve form was re-recorded here by #1319's bulk expectation update,
    // when the C# port was missing English.CreoleCitation and leaked the parent's extra-short schwa into
    // Naija. The TS twin kept the right value throughout, which is what the port had drifted from.
    [InlineData("analyse", "analaiz")]
    public void TheDictOnlyLookupFoldsSoCreolesNativiseACommonwealthSpelling(string word, string ipa)
        => Assert.Equal(ipa, Phonemizer.Phonemize(word, "pcm"));
}
