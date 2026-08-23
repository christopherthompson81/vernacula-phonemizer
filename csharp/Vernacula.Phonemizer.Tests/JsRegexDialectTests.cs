// The four JS/.NET dialect gaps the differential harness found, pinned as tests.
//
// ⚠ WHY THESE ARE HERE AND NOT LEFT TO THE HARNESS. csharp/regex-corpus.jsonl is REGENERATED from
// src/ on every run, so its coverage is a function of what the extractor happens to find. An
// extractor that stops seeing a pattern (a stripper change, a moved file) takes the coverage with it
// and still reports "0 DIFFER" — the failure mode where everything is green and nothing is checked.
// Every expectation below was read off Node, not reasoned out.
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsRegexDialectTests
{
    private static bool M(string pattern, string flags, string input) => JsRegex.Compile(pattern, flags).IsMatch(input);

    // ---- simple case folding under /iu -------------------------------------------------------
    // JS /iu folds with scf(); .NET IgnoreCase does not equate any of these pairs.

    [Theory]
    [InlineData("[a-z]", "ſ")]      // LATIN SMALL LETTER LONG S folds to s
    [InlineData("s", "ſ")]          // ...as a bare literal too
    [InlineData("[ι]", "ͅ")]   // COMBINING GREEK YPOGEGRAMMENI folds to iota
    [InlineData("[д]", "ᲁ")]   // pre-1918 Cyrillic de
    [InlineData("[μ]", "µ")]   // MICRO SIGN folds to greek mu
    public void FoldsWideUnderIU(string pattern, string input) => Assert.True(M(pattern, "iu", input));

    [Fact]
    public void LegacyIDoesNotFoldNonAsciiOntoAscii()
    {
        // ⚠ THE GATE THAT MAKES THE FOLD CORRECT. ECMAScript's legacy Canonicalize refuses a fold whose
        // result is ASCII when the input is not, so /[bcdfgmpst]/i must MISS a long s. Applying the
        // fold on the i flag alone regressed exactly this pattern (scottishgaelic/numbers.ts).
        Assert.False(M("^[bcdfgmpst]", "i", "ſ"));
        Assert.True(M("^[bcdfgmpst]", "iu", "ſ"));
    }

    [Fact]
    public void FoldExtrasSurviveNegation()
    {
        // A negated class must EXCLUDE the fold partner, which is what adding it to the body does.
        Assert.False(M("[^a-z]", "iu", "ſ"));
        Assert.True(M("[^a-z]", "iu", "д"));
    }

    // ---- [^\S...]: JS's horizontal whitespace ------------------------------------------------

    [Theory]
    [InlineData(" ", true)]
    [InlineData("\t", true)]
    [InlineData(" ", true)]
    [InlineData("\n", false)]
    [InlineData("a", false)]
    public void NegatedClassWithNonSpace(string input, bool expected) => Assert.Equal(expected, M("[^\\S\\n]", "gu", input));

    // ---- \p{ASCII} ---------------------------------------------------------------------------

    [Fact]
    public void AsciiProperty()
    {
        Assert.True(M("[^\\p{ASCII}]", "u", "é"));
        Assert.False(M("[^\\p{ASCII}]", "u", "a"));
    }

    // ---- astral members inside a class -------------------------------------------------------
    // .NET classes match UTF-16 UNITS, so an astral member cannot live in the class: it becomes a
    // surrogate-pair alternation OR-ed around it. Getting this wrong matches lone surrogates instead.

    [Theory]
    [InlineData("\U0001E950", true)]   // ADLAM DIGIT ZERO, in range
    [InlineData("\U0001E94F", false)]  // one below
    public void AstralRangeClass(string input, bool expected) => Assert.Equal(expected, M("[\\u{1E950}-\\u{1E959}]", "u", input));

    [Theory]
    [InlineData("々", true)]            // BMP member alongside the astral range
    [InlineData("\U00020001", true)]   // inside \u{20000}-\u{2a6df}
    [InlineData("\U0002B740", false)]  // Han, but outside the written range
    public void MixedBmpAndAstralClass(string input, bool expected) =>
        Assert.Equal(expected, M("[㐀-鿿\\u{20000}-\\u{2a6df}々]", "u", input));

    [Fact]
    public void AstralMemberMatchesTheWholeCodePoint()
    {
        var m = JsRegex.Compile("[㐀-鿿\\u{20000}-\\u{2a6df}々]", "u").Match("a\U00020001b");
        Assert.True(m.Success);
        Assert.Equal("\U00020001", m.Value);   // not a lone high surrogate
    }
}

// Code points vs code units: .NET always matches one UTF-16 unit, JS under /u matches one code
// point. Every expectation here was read off Node.
public class JsRegexCodePointTests
{
    private static (int Index, string Value)[] All(string pattern, string flags, string input) =>
        JsRegex.Compile(pattern, flags).Matches(input).Select(m => (m.Index, m.Value)).ToArray();

    [Fact]
    public void CategoryMatchesAstralLetter() =>
        Assert.Equal(new[] { (0, "a"), (1, "\U00020001") }, All("\\p{L}", "gu", "a\U00020001\U0001F600"));

    [Fact]
    public void CategoryMatchesAstralDigit() =>
        Assert.Equal(new[] { (0, "7"), (1, "\U0001E950") }, All("\\p{Nd}", "gu", "7\U0001E950"));

    [Fact]
    public void ScriptWithNoBmpHalfMatchesTheWholePair() =>
        Assert.Equal(new[] { (0, "\U0001E950") }, All("\\p{Script=Adlam}", "gu", "\U0001E950x"));

    [Fact]
    public void NegatedClassTakesAWholeCodePoint() =>
        Assert.Equal(new[] { (1, "\U0001F600"), (3, "b") }, All("[^a]", "gu", "a\U0001F600b"));

    [Fact]
    public void NonDigitTakesAWholeCodePoint() =>
        Assert.Equal(new[] { (1, "\U0001F600") }, All("\\D", "gu", "1\U0001F600"));

    // ⚠ THE TWO ADVANCE RULES. After a zero-length match JS skips a whole code point; after a FAILED
    // attempt it steps one code unit — which is why index 3, inside a surrogate pair, is a position
    // Node really does report. Regex.Matches reproduces neither, so JsRe drives the loop itself.

    [Fact]
    public void ZeroLengthMatchAdvancesByCodePoint() =>
        Assert.Equal(new[] { (0, ""), (2, "") }, All("(?:)", "gu", "\U00020001"));

    [Fact]
    public void FailedAttemptAdvancesByCodeUnit() =>
        Assert.Equal(new[] { (0, ""), (3, "") }, All("(?<![\\p{L}])", "gu", "\U00020001\U0002B740"));

    [Fact]
    public void AstralBranchesAreGuarded()
    {
        // ⚠ A PERF INVARIANT, ASSERTED STRUCTURALLY because a timing test would be flaky. Without the
        // one-class lookahead in front of the surrogate-pair alternation, [\p{L}\p{M}]+ ran 372 ms
        // where plain .NET ran 16 ms — a 23x tax on every phonemization, and nothing about the OUTPUT
        // would have looked wrong.
        var translated = JsRegex.Compile("[\\p{L}\\p{M}]+", "gu").Re.ToString();
        Assert.Contains("(?=[\uD800-\uDBFF])(?:", translated);
    }

    [Fact]
    public void GlobalReplaceUsesTheSameRules()
    {
        Assert.Equal("-a-\U0001F600-b-", JsRegex.Compile("(?:)", "gu").Replace("a\U0001F600b", "-"));
        Assert.Equal("|\U00020001\ud86d|\udf40", JsRegex.Compile("(?<![\\p{L}])", "gu").Replace("\U00020001\U0002B740", "|"));
    }
}
