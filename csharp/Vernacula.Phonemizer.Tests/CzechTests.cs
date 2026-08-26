// The portable half of test/czech.test.ts — the branches the 200-row golden cannot reach: the g2p's
// context systems, the ordinal-case heuristics, and the two defects the port sent back to the TypeScript
// (the one-letter `s.` abbreviation, and the >2^53 digit run of #1059).
using Vernacula.Phonemizer;
using CzechEngine = Vernacula.Phonemizer.Languages.Czech.CzechPhonemizer;
using CzechNormalize = Vernacula.Phonemizer.Languages.Czech.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CzechTests
{
    [Theory]
    [InlineData("divadlo", "ɟˈɪvadlo")]      // di → ɟɪ
    [InlineData("děti", "ɟˈɛcɪ")]            // dě → ɟɛ, ti → cɪ
    [InlineData("běh", "bjˈɛx")]             // bě → bjɛ, ch → x
    [InlineData("měl", "mɲˈɛl")]             // mě → mɲɛ
    [InlineData("policie", "pˈolɪt͡sˌɪjɛ")]   // hiatus i+e → ɪjɛ
    [InlineData("venku", "vˈɛŋku")]          // n → ŋ before k
    [InlineData("led", "lˈɛt")]              // final devoicing
    [InlineData("kde", "ɡdˈɛ")]              // regressive k → ɡ
    [InlineData("prosba", "prˈozba")]
    [InlineData("vstup", "fstˈup")]
    [InlineData("sníh", "sɲˈiːx")]
    [InlineData("rozhodně", "rˈosɦodɲɛ")]    // z → s before ɦ
    [InlineData("tři", "tr̝̊ˈɪ")]              // ř devoices after voiceless t
    [InlineData("tvář", "tvˈaːr̝̊")]
    [InlineData("krk", "kˈr̩k")]              // syllabic r̩
    [InlineData("vlk", "vˈl̩k")]              // syllabic l̩
    [InlineData("republika", "rˈɛpublˌɪka")] // secondary stress on the even non-final nucleus
    [InlineData("vyšší", "vˈɪʃʃiː")]         // a non-n geminate is kept
    [InlineData("činnost", "t͡ʃˈɪnost")]      // nn → n
    public void PhonemizeWordReadsTheContextSystems(string word, string want) =>
        Assert.Equal(want, CzechEngine.PhonemizeWord(word));

    [Theory]
    [InlineData("21. století", "dvacátého prvního století")]
    [InlineData("ve 21. století", "ve dvacátém prvním století")]
    [InlineData("3. května", "třetího května")]
    [InlineData("v 90. letech", "v devadesátých letech")]
    [InlineData("14:30", "čtrnáct hodin třicet minut")]
    [InlineData("21:00", "dvacetjedna hodin")]  // gen-pl for a compound ending in 1, not *hodina
    [InlineData("1:15", "jedna hodina patnáct minut")] // feminine agreement on 1
    [InlineData("22:00", "dvacetdvě hodiny")]
    [InlineData("1 234", "1234")]
    [InlineData("1990-1995", "1990 do 1995")]
    [InlineData("-5", "mínus 5")]
    [InlineData("−5", "mínus 5")]
    [InlineData("A&B", "A a B")]
    [InlineData("Praha-východ", "Praha-východ")]
    [InlineData("Čeština je jazyk.", "Čeština je jazyk.")]
    // `s.` (strana) is ONE LETTER and the shared abbreviation rule's lookahead admits a following letter,
    // so every Latin initial spelled `S.` was read as the word *strana*. Both corpus instances are `s. 109`.
    [InlineData("viz s. 109", "viz strana 109")]
    [InlineData("J. S. Bach", "J. S. Bach")]
    public void NormalizeRewritesWhatItClaims(string input, string want) =>
        Assert.Equal(want, CzechNormalize.NormalizeCzech(input));

    // #1059: the overflow fallback derived its digits from the DOUBLE, so above 1e21 the stringification was
    // exponent form and the run's last digit was lost.
    [Fact]
    public void A22DigitRunKeepsItsOwnDigits()
    {
        var a = Phonemizer.Phonemize("1000000000000000000001", "cs");
        var b = Phonemizer.Phonemize("1000000000000000000009", "cs");
        Assert.NotEqual(a, b);
        Assert.EndsWith("jˈɛdɛn", a, StringComparison.Ordinal);
        Assert.EndsWith("dˈɛvjɛt", b, StringComparison.Ordinal);
        Assert.Equal(22, a.Split(' ').Length);
    }
}
