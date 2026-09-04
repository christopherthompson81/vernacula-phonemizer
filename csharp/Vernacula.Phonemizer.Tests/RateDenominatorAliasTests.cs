// The C# half of test/rate-denominator.test.ts's #1257 block — the nine silent rate pairs the repo already
// had the noun for, now read in full on this side too.
//
// #1255 made an unreadable denominator silent rather than spoken and left 208 code+shape pairs reading short.
// #1257 classified those by what each language ALREADY DECLARES: tg, jv and mad had the noun under a native key
// and needed only the ASCII alias; tl, an and haw had the sibling key and the noun attested in their own artifact.
// Four of the six are inline declarations mirrored by hand on this side, so a golden cannot catch a mirror that
// was missed — none of the six goldens carries one of these shapes — which is what this file is for.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class RateDenominatorAliasTests
{
    private static string Say(string s, string code) => Phonemizer.Phonemize(s, code).Trim();

    [Theory]
    // Pure aliases of a noun the language had declared under its own spelling…
    [InlineData("tg", "160 km/h", "sadˈu ʃˈast kilɔmˈetr dˈar sɔˈat")] // = `160 км/соат`
    [InlineData("tg", "160 kg/h", "sadˈu ʃˈast kilɔɡrˈamm dˈar sɔˈat")]
    [InlineData("jv", "160 km/h", "sˈat̪ʊs səwˈid̪aʔ kilomˈɛt̪ər pˈər d͡ʒˈam")] // = `160 km/jam`
    [InlineData("mad", "160 m/s", "atɔs bɤn ənːəm pɔlɔ mɛtəɾ pəɾ dɨtik")] // = `160 m/detik`
    // …and three nouns attested in the language's own artifact, composed by the per-word it already declared.
    [InlineData("tl", "160 km/h", "sandaʔˈan ʔˈat ʔanimnapˈu kilomˈetɾo bˈawat ʔˈoɾas")]
    [InlineData("an", "160 m/s", "θjent siʃanta metɾos po seɡundo")]
    [InlineData("haw", "160 m/s", "hoʔokahi haneli kanaono mika o ka kekona")]
    // ⚠ AND THE ONE ALIAS THAT LOOKED FREE AND IS NOT: tg's one artifact `км/с` is a running speed, per HOUR by
    // the number, so Cyrillic `с` stays undeclared and the symbol is still spoken — outside the ASCII-only guard.
    [InlineData("tg", "160 км/с", "sadˈu ʃˈast kilɔmˈetr s")]
    public void TheRepoAlreadyHadTheNoun(string code, string input, string want) => Assert.Equal(want, Say(input, code));
}
