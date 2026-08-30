/**
 * `Js.Normalize` must be JS's `String.prototype.normalize`, which NEVER throws.
 *
 * ⚠ .NET's `string.Normalize` REFUSES a string containing an UNPAIRED SURROGATE —
 * `ArgumentException: String contains invalid Unicode code points` — where JS returns it unchanged. That
 * matters because a g2p indexing UTF-16 code units hands the halves of an astral character over ONE AT A
 * TIME, which the Ewe and Irish scans do deliberately, so this is a designed-for input.
 *
 * ⚠ THIS IS THE THIRD APPEARANCE OF ONE HAZARD. `LatinPhones.LatinPhone` guards it for its own NFD;
 * `Js.ToLowerCase` had it via `char.ConvertFromUtf32` (#1195); the language engines have it on the raw
 * input word (#1199 — 25 of 193 languages throw from `Phonemize()`, and 46 sites carry the shape).
 *
 * Every expectation here is Node's own `normalize` answer.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class JsNormalizeTests
{
    /// ⚠ Each row carries a LABEL because xUnit hashes the serialized display name, and a lone high and a
    /// lone low surrogate both render as U+FFFD — without it two rows collide and one is SILENTLY SKIPPED.
    [Theory]
    [InlineData("lone high", "\ud83d", "\ud83d")]
    [InlineData("lone low", "\ude00", "\ude00")]
    [InlineData("stranded mid-word", "a\ud83db", "a\ud83db")]
    [InlineData("leading half", "\ud83da", "\ud83da")]
    [InlineData("the well-formed pair", "\ud83d\ude00", "\ud83d\ude00")]
    // ⚠ THE WELL-FORMED PARTS STILL COMPOSE. A first version of this helper returned the whole string
    // unchanged whenever it held an unpaired half, and these three rows are what caught it.
    [InlineData("half then a decomposition", "\ud83de\u0301", "\ud83d\u00e9")]
    [InlineData("decomposition then half", "e\u0301\ud83d", "\u00e9\ud83d")]
    [InlineData("a decomposition on each side", "a\ud83de\u0301b", "a\ud83d\u00e9b")]
    // …and the control: a well-formed string composes exactly as `string.Normalize` would.
    [InlineData("no surrogate at all", "e\u0301", "\u00e9")]
    public void ALoneSurrogateIsReturnedUnchangedNotThrownOn(string label, string s, string want) =>
        Assert.Equal(want, Js.Normalize(s, NormalizationForm.FormC));

    /** ⚠ AND THE UNGUARDED CALL REALLY DOES THROW — the pin is worthless if .NET ever stops refusing. */
    [Fact]
    public void TheUnguardedDotNetCallThrows() =>
        Assert.Throws<ArgumentException>(() => "\ud83d".Normalize(NormalizationForm.FormC));

    /**
     * The engine entry point that found it: `PhonemizeWord` normalizes the RAW WORD to build its lexicon
     * key, so it threw where the TypeScript answers `ʔˈa`. Found by an astral/surrogate g2p walk — 2,205
     * of 8,379 words threw before the fix.
     */
    [Theory]
    [InlineData("a\ud83d", "ʔˈa")]
    [InlineData("\ud83da", "ʔˈa")]
    [InlineData("a\ud83db", "ʔˈab")]
    [InlineData("\ud83d", "")]
    public void IlocanoPhonemizeWordSurvivesALoneSurrogate(string word, string want) =>
        Assert.Equal(want, Languages.Ilocano.IlocanoPhonemizer.PhonemizeWord(word));
}
