using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

/**
 * `Js.ToLowerCase` must be JS's `toLowerCase`, which `ToLowerInvariant` is not.
 *
 * ⚠ THE GREEK FINAL SIGMA IS THE WHOLE DIFFERENCE, and .NET has no culture that implements it — invariant,
 * el-GR and current were all checked and all return σ. JS applies the Unicode SpecialCasing `Final_Sigma`
 * condition, so `"ΠΟΙΟΣ".toLowerCase()` is `ποιος`. The Greek g2p's consonant test excludes ς BY NAME, so
 * the two engines took different branches and `ΠΟΙΟΣ` read `pios` in C# against `pços` in Node.
 *
 * ⚠ Found by an off-golden probe, not by the gate: no golden row contains an all-caps unaccented Greek word.
 * The expectations below were verified against Node over 1,785 generated sigma strings, 0 differing.
 */
public class JsToLowerCaseTests
{
    [Theory]
    // A cased letter before and nothing cased after ⇒ FINAL sigma.
    [InlineData("ΠΟΙΟΣ", "ποιος")]
    [InlineData("ΟΔΟΣ", "οδος")]
    [InlineData("ΑΣ", "ας")]
    [InlineData("ΑΣ.", "ας.")]
    [InlineData("ΑΣ ", "ας ")]
    // A cased letter follows ⇒ medial sigma.
    [InlineData("ΣΟΦΟΣ", "σοφος")]
    [InlineData("ΑΣΑ", "ασα")]
    [InlineData("ΣΣ", "σς")]
    // Nothing cased before ⇒ medial, even at the end of the string.
    [InlineData("Σ", "σ")]
    [InlineData("1Σ", "1σ")]
    // A digit is not case-ignorable, so it blocks the "cased before" search.
    [InlineData("Σ1", "σ1")]
    // Non-Greek text is untouched, and takes the fast path.
    [InlineData("ABC", "abc")]
    [InlineData("Ünïcödé", "ünïcödé")]
    public void MatchesJavaScript(string input, string expected) =>
        Assert.Equal(expected, Js.ToLowerCase(input));

    [Fact]
    public void DiffersFromToLowerInvariantExactlyOnTheFinalSigma()
    {
        Assert.Equal("ποιοσ", "ΠΟΙΟΣ".ToLowerInvariant()); // ⚠ what .NET does
        Assert.Equal("ποιος", Js.ToLowerCase("ΠΟΙΟΣ"));    // ⚠ what JS does
    }

    // ── #1116 ────────────────────────────────────────────────────────────────────────────────────────
    // The sigma was not the only divergence. Found by sweeping ALL 1,114,112 code points through both
    // engines rather than by reading the SpecialCasing table: JS lowercased 1,460 of them to something
    // else, .NET 1,432, and the 28-code-point difference had two causes — U+0130's length-changing
    // SpecialCasing entry, and 27 plain mappings that .NET's Unicode table predates.

    [Theory]
    [InlineData("\u0130", "i\u0307")]             // İ — the one LENGTH-CHANGING entry: one char in, two out
    [InlineData("\u0130stanbul", "i\u0307stanbul")]
    [InlineData("\u1C89", "\u1C8A")]              // Unicode 12 — Cyrillic
    [InlineData("\uA7CB", "\u0264")]              // Unicode 16 — Latin Extended-D
    [InlineData("\uA7DC", "\u019B")]
    [InlineData("\U00010D50", "\U00010D70")]      // Unicode 16 — Garay, and ASTRAL
    // …and the cases .NET already had, unchanged.
    [InlineData("\u1E9E", "\u00DF")]              // ẞ → ß
    [InlineData("\u017F", "\u017F")]              // ſ stays
    [InlineData("\u03A0\u039F\u0399\u039F\u03A3", "\u03C0\u03BF\u03B9\u03BF\u03C2")] // ΠΟΙΟΣ → ποιος
    public void TheMappingsDotNetLacks(string input, string want) => Assert.Equal(want, Js.ToLowerCase(input));

    /**
     * ⚠ FINAL_SIGMA MUST SEE AN ASTRAL LETTER AS CASED. `char.GetUnicodeCategory(char)` reports `Surrogate`
     * for either half of a pair, so a Σ beside an astral cased letter took the wrong branch. The
     * single-code-point sweep cannot catch this — it takes two characters to build — and a 20,000-string
     * fuzz against Node found 314 of them.
     */
    [Theory]
    [InlineData("\U00010D50\u03A3", "\U00010D70\u03C2")]              // cased before, nothing after → ς
    [InlineData("\U00010D50\u03A3!\u039F", "\U00010D70\u03C2!\u03BF")] // `!` is not case-ignorable
    [InlineData("A\u03A3\U00010D501", "a\u03C3\U00010D701")]          // a cased letter AFTER → medial σ
    [InlineData("\u03C3\u03A0\u03A3\U00010D50", "\u03C3\u03C0\u03C3\U00010D70")]
    public void FinalSigmaSeesAstralCasedLetters(string input, string want) =>
        Assert.Equal(want, Js.ToLowerCase(input));

    /** ⚠ THE FAST PATH MUST NOT SWALLOW THE NEW CASES — a string with no Σ still needs the table. */
    [Fact]
    public void TheFastPathStillHandlesTheExtraMappings()
    {
        Assert.Equal("i\u0307", Js.ToLowerCase("\u0130")); // no Σ anywhere
        Assert.Equal("abc", Js.ToLowerCase("ABC"));         // and the ordinary string is untouched
    }
}

/**
 * #1119 — the word paths must REACH `Js.ToLowerCase`.
 *
 * ⚠ #1116 REPAIRED THE HELPER AND THE SYMPTOM SURVIVED, because ~214 sites lowercase with a bare
 * `ToLowerInvariant()` and never call it. The English foreign reader was the big one: a Latin run inside
 * any non-Latin text is handed to it, and it lowercased directly — so `İ` leaked its capital into the
 * phoneme stream of 87 of the 132 ported languages, 2,544 probe rows, long after the helper was correct.
 *
 * These pin the SHAPE at the fleet level: a language of each routing kind, on the one code point whose
 * mapping is length-changing.
 */
public class LowercaseReachesTheWordPathTests
{
    [Theory]
    // Routed to the ENGLISH reader — the path that carried 87 of the 87.
    [InlineData("mn", "İ")]
    [InlineData("ru", "İ")]
    [InlineData("ja", "İ")]
    [InlineData("ar", "İ")]
    // …and the Latin-script engines that lowercase in their own g2p head.
    [InlineData("sv", "İ")]
    [InlineData("af", "İ")]
    [InlineData("yo", "İ")]
    [InlineData("umb", "İ")]
    [InlineData("en", "İ")]
    [InlineData("en-GB", "İ")]
    public void ACapitalIWithDotAboveDoesNotLeakItsCapital(string code, string input)
    {
        var got = Phonemizer.Phonemize(input, code);
        Assert.DoesNotContain("İ", got);
        // …and it is not silently dropped either — the TS reads it as a vowel in every one of these.
        Assert.NotEqual("", got.Trim());
    }

    /** The same for a run, which is what actually occurs — a Turkish name inside another language. */
    [Theory]
    [InlineData("mn")]
    [InlineData("ru")]
    [InlineData("sv")]
    public void ANameCarryingItReadsWithoutLeaking(string code)
    {
        var got = Phonemizer.Phonemize("İstanbul", code);
        Assert.DoesNotContain("İ", got);
        Assert.DoesNotContain("I", got);
    }
}
