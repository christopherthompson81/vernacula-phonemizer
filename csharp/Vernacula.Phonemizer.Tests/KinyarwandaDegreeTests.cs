// The `dogere` redundancy guard must not read the engine's OWN insertions.
//
// `SaidNear` asks one question — did the WRITER already write the noun? — and it reads the pre-replacement
// string, which within a single pass is exactly right (two matches in one pass are invisible to each other).
// Across passes it was not: by arm 4c the string carried 4a's inserted `dogere`, so ONE CONSTRUCTION GOT TWO
// ANSWERS depending on which arm claimed each half — and in the mixed case the parenthetical lost its noun
// AND its scale word, reading a bare *(6 1)*.
//
// ⚠ Every emitted `dogere` now carries a U+0000 mark; the guard strips a marked occurrence before testing;
// the marks come off after 4e, the LAST arm. ⚠ 0 golden rows move — the evidence is the corpus's own
// °C/(°F) glosses, so this is pinned here rather than gated.
using RwNormalize = Vernacula.Phonemizer.Languages.Kinyarwanda.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class KinyarwandaDegreeTests
{
    [Theory]
    // Both figures negative → both claimed by 4a, one pass, neither sees the other. Already right.
    [InlineData("\u221227.2 \u00b0C (\u221217.0 \u00b0F)",
                "dogere selisiyusi 27 2 munsi ya zeru (dogere 17 0 munsi ya zeru)")]
    // First 4a, second 4c — 4c used to see 4a's insertion and suppress. Was *(6 1)*, bare.
    [InlineData("\u221214.4 \u00b0C (6.1 \u00b0F)",
                "dogere selisiyusi 14 4 munsi ya zeru (dogere 6 1)")]
    // …and the word the WRITER wrote still suppresses it, for every figure in reach.
    [InlineData("dogere 22\u00b0 na 35\u00b0", "dogere 22 na 35")]
    // With no noun in the source, each figure gets its own — including across arms (4a then 4e).
    [InlineData("hagati ya 22\u00b0 na 35\u00b0", "hagati ya dogere 22 na dogere 35")]
    [InlineData("\u22125 \u00b0C na 30\u00b0", "dogere selisiyusi 5 munsi ya zeru na dogere 30")]
    // The coordinate arm still repeats the noun per AXIS, which rw does on purpose.
    [InlineData("2\u00b0 36\u2032 58\u2033 S, 29\u00b0 44\u2032 34\u2033 E",
                "dogere 2 36\u2032 58\u2033 amajyepfo, dogere 29 44\u2032 34\u2033 iburasirazuba")]
    public void TheGuardSeesOnlyWhatTheWriterWrote(string input, string want) =>
        Assert.Equal(want, RwNormalize.NormalizeKinyarwanda(input));

    [Theory]
    [InlineData("\u221227.2 \u00b0C (\u221217.0 \u00b0F)")]
    [InlineData("40-42 \u00b0")]
    [InlineData("2\u00b0 36\u2032 58\u2033 S")]
    [InlineData("dogere 22\u00b0")]
    [InlineData("42")]
    public void TheMarkCanNeverReachTheOutput(string input)
    {
        Assert.DoesNotContain("\u0000", RwNormalize.NormalizeKinyarwanda(input), StringComparison.Ordinal);
        Assert.DoesNotContain("\u0000", Phonemizer.Phonemize(input, "rw"), StringComparison.Ordinal);
    }
}
