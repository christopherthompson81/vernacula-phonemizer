// A CASE-FOLDED CLASS MUST NOT REACH AN ABSENT TABLE ENTRY — the C# half of test/case-folded-lookup.test.ts.
//
// ⚠ THE C# FAILURE MODE IS WORSE THAN THE TS ONE, which is why this file exists separately. Under `/iu` JS
// folds U+017F LONG S onto `s`, so `&ſup2` matches an entity pattern and `12°ſ` matches `[NSEW]` while the
// key computed from the match is in no table. The TypeScript asserted non-null and `String.replace`
// stringified the `undefined`, so the WORD was spoken; a .NET dictionary indexer THROWS, so
// `Phonemize` raised `KeyNotFoundException` for the whole caller on four of the five sites (#1122).
//
// ⚠ AND THE TRIGGER IS ALREADY IN THIS TREE'S OWN DATA: `csharp/goldens/nci.tsv` carries `Caſtellana` and
// `Confeſsionario` in 16th-century book titles. The five corpora involved write it zero times today, which
// is exactly why no corpus differential found it — the trigger is one wiki page away, not one dump away.
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class CaseFoldedLookupTests
{
    /** The fold triggers this tree can actually meet, each widening a class beyond its table. */
    private static readonly string[] TRIGGERS = ["ſ", "K", "Å"];

    [Theory]
    [InlineData("wo", "km&ſup2 bi")]
    [InlineData("wo", "&nbſp x")]
    [InlineData("qu", "km&ſup2; bi")]
    [InlineData("qu", "&nbſp; x")]
    [InlineData("so", "12°ſ")]
    [InlineData("su", "12°ſ")]
    [InlineData("id", "12°ſ")]
    public void AFoldedNearMissNeitherThrowsNorSpeaksUndefined(string lang, string text)
    {
        var got = Phonemizer.Phonemize(text, lang);
        Assert.DoesNotContain("undefined", got, StringComparison.Ordinal);
    }

    /** ⚠ AND THE WELL-FORMED NEIGHBOUR IS UNTOUCHED, so the guard did not over-refuse. */
    [Theory]
    [InlineData("so", "12°N", "12°ſ")]
    [InlineData("su", "12°N", "12°ſ")]
    [InlineData("id", "12°N", "12°ſ")]
    public void TheWellFormedNeighbourStillReads(string lang, string good, string folded) =>
        Assert.NotEqual(Phonemizer.Phonemize(good, lang), Phonemizer.Phonemize(folded, lang));

    /** The whole trigger set over every site's shape, so a NEW fold-widened class fails here rather than in
     *  a corpus nobody has run yet. */
    [Fact]
    public void NoFoldTriggerThrowsOrSpeaksUndefinedAtAnySite()
    {
        (string Lang, string Shape)[] sites =
        [
            ("wo", "km&Xup2 bi"), ("wo", "&nbXp x"), ("qu", "km&Xup2; bi"), ("qu", "&nbXp; x"),
            ("so", "12°X"), ("su", "12°X"), ("id", "12°X"),
        ];
        foreach (var (lang, shape) in sites)
        {
            foreach (var ch in TRIGGERS)
            {
                var probe = shape.Replace("X", ch, StringComparison.Ordinal);
                var got = Phonemizer.Phonemize(probe, lang);   // must not throw
                Assert.DoesNotContain("undefined", got, StringComparison.Ordinal);
            }
        }
    }
}
