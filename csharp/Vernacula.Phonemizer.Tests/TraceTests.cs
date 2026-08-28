/*
 * The portable half of test/trace.test.ts — `PhonemizeTrace` (#1150 stage 1).
 *
 * ⚠ THE CONTRACT IS THAT IT IS A SECOND VIEW, NEVER A SECOND READING: `Ipa` must equal `Phonemize`. The
 * parity gate is 136 languages × 26,827 rows across two engines, and a second output shape that could drift
 * from the first would be a fork wearing a feature's clothes.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TraceTests
{
    [Theory]
    [InlineData("Łódź ne 1244", "lg")]
    [InlineData("el gato negro", "es")]
    [InlineData("the cat sat", "en")]
    [InlineData("le chat noir", "fr")]
    [InlineData("中国 hello 世界", "cmn")]
    [InlineData("Это Windows компьютер", "ru")]
    [InlineData("Obugazi: 1 244.7 km²", "lg")]
    public void TheTraceDoesNotChangeTheReading(string text, string lang) =>
        Assert.Equal(Phonemizer.Phonemize(text, lang), Phonemizer.PhonemizeTrace(text, lang).Ipa);

    /**
     * ⚠ AN UNTRACED ENGINE MUST NOT LOOK LIKE A CLEAN ONE — an empty token list is indistinguishable from a
     * correct trace, the very defect this API exists to expose. The four engines that hand-roll their
     * tokenizer loop (english, french, mandarin, burmese) report explicitly rather than through the seam.
     */
    [Theory]
    [InlineData("the cat sat", "en", "the|cat|sat")]
    [InlineData("le chat noir", "fr", "le|chat|noir")]
    [InlineData("中国 hello 世界", "cmn", "中国|hello|世界")]
    [InlineData("မြန်မာ ABC", "my", "မြန်မာ|ABC")]
    [InlineData("Obugazi ne Łódź", "lg", "Obugazi|ne|Łódź")]
    public void EveryEngineReportsItsTokensWithUsableSpans(string text, string lang, string want)
    {
        var t = Phonemizer.PhonemizeTrace(text, lang);
        Assert.True(t.Traced, $"{lang} reported no trace at all");
        Assert.Equal(want, string.Join("|", t.Tokens.Select(k => k.Surface)));
        foreach (var k in t.Tokens) Assert.Equal(k.Surface, t.Normalized[k.Start..k.End]);
    }

    /** The input-side rewrite that leaves no mark on the output — the step behind #1131, #1139, #1140. */
    [Fact]
    public void NativisedRecordsTheFoldThatLeavesNoMark()
    {
        Assert.Equal("Lodz", Phonemizer.PhonemizeTrace("Łódź", "lg").Tokens[0].Nativised);
        Assert.Equal("gato", Phonemizer.PhonemizeTrace("ɡato", "es").Tokens[0].Nativised); // #1132's U+0261
        Assert.Null(Phonemizer.PhonemizeTrace("gato", "es").Tokens[0].Nativised); // untouched → absent
    }

    /** One source token, many readings — the number path, in both a seam engine and a hand-rolled one. */
    [Theory]
    [InlineData("1244", "lg")]
    [InlineData("I have 1244 cats.", "en")]
    public void OneTokenCanEmitManyReadings(string text, string lang)
    {
        var n = Phonemizer.PhonemizeTrace(text, lang).Tokens.First(k => k.Surface == "1244");
        Assert.True(n.Emitted.Count > 3, $"expected a numeral to expand, got {n.Emitted.Count}");
    }

    /**
     * ⚠ A post-assembly pass means `Emitted` is NOT a substring of `Ipa`, so the discrepancy must carry its
     * cause. Spanish spirantizes across word boundaries after the clause string is assembled.
     */
    [Fact]
    public void APostAssemblyRewriteIsAnEvent()
    {
        var t = Phonemizer.PhonemizeTrace("el gato negro", "es");
        Assert.Equal(new[] { "ɡˈato" }, t.Tokens.First(k => k.Surface == "gato").Emitted);
        Assert.Contains("ɣˈato", t.Ipa);
        var r = Assert.Single(t.Rewrites, x => x.Stage == "spirantize-across-words");
        Assert.Contains("ɣˈato", r.After);
    }

    /** Normalization is reported for every engine at once — including when it REORDERS. */
    [Fact]
    public void NormalizationIsAnEventEvenWhenItReorders()
    {
        var t = Phonemizer.PhonemizeTrace("Obugazi: 1 244.7 km²", "lg");
        var n = Assert.Single(t.Rewrites, x => x.Stage == "normalize");
        Assert.Equal("Obugazi: 1 244.7 km²", n.Before);
        Assert.Equal(t.Normalized, n.After);
        // the unit's reading precedes the figure it FOLLOWED — why a span cannot be mapped back (stage 2)
        Assert.True(n.After.IndexOf("kiromita", StringComparison.Ordinal) < n.After.IndexOf("1244", StringComparison.Ordinal));
    }

    [Fact]
    public void AStageThatChangedNothingEmitsNoEvent() =>
        Assert.Empty(Phonemizer.PhonemizeTrace("the cat", "en").Rewrites);

    /** The recorder is ambient, so prove a nested engine cannot steal or drop the outer engine's readings. */
    [Fact]
    public void ANestedEngineDoesNotStealTheOuterEnginesTokens()
    {
        var t = Phonemizer.PhonemizeTrace("Это Windows компьютер", "ru");
        Assert.Equal("Это|Windows|компьютер", string.Join("|", t.Tokens.Select(k => k.Surface)));
        // ⚠ the embedded run's reading BELONGS to a token — leaving it out attributed real IPA to nothing
        Assert.NotEmpty(t.Tokens.First(k => k.Surface == "Windows").Emitted);
    }

    [Fact]
    public void AThrowingCallLeavesNoStateForTheNext()
    {
        Assert.ThrowsAny<Exception>(() => Phonemizer.PhonemizeTrace("x", "definitely-not-a-language"));
        var t = Phonemizer.PhonemizeTrace("ŋŋamba", "lg");
        Assert.Single(t.Tokens);
        Assert.Equal(Phonemizer.Phonemize("ŋŋamba", "lg"), t.Ipa);
    }
    /**
     * #1150 stage 2 — normalizer provenance. ⚠ The seam is `Rewriter.Rewrite`, spelled and ordered exactly
     * as the TypeScript's `rewrite(s, re, rep)`. It was once `JsRe.Replace`, which needed no edits under
     * Languages/ at all — but that method is also how a static constructor builds a lookup table and how an
     * engine rewrites IPA, so the mapping could not tell "a step I did not see" from "a string that is not
     * mine" and had to tolerate both. Two wrong-span defects came through that tolerance.
     */
    [Fact]
    public void ATokenNamesTheInputCharactersThatProducedIt()
    {
        const string text = "Obugazi: 1 244.7 km² ne 15%.";
        var t = Phonemizer.PhonemizeTrace(text, "lg");
        string? Src(string surface)
        {
            var k = t.Tokens.FirstOrDefault(x => x.Surface == surface);
            return k?.InputSpan is null ? null : text[k.InputSpan.Value.Start..k.InputSpan.Value.End];
        }
        // the unit's reading-words and the figure all trace to the one source span they came from
        Assert.Equal("1 244.7 km²", Src("kiromita"));
        Assert.Equal("1 244.7 km²", Src("1244"));
        Assert.Equal("15%", Src("kikumi"));
        Assert.Equal("Obugazi", Src("Obugazi")); // untouched text maps to itself
    }

    /**
     * ⚠ ABSENCE MEANS "NOT KNOWN", NEVER "IDENTICAL". A step that does not report still changes the string,
     * so the mapping desyncs and is WITHHELD rather than reported wrong — the difference between an unknown
     * and a confident wrong offset. In the TS this defect shipped and named 1,478 tokens wrongly before the
     * entry check was added.
     */
    [Theory]
    [InlineData("Obugazi: 1 244.7 km² ne 15%.", "lg")]
    [InlineData("Dr. Smith paid $1,250.", "en")]
    [InlineData("<b>hi</b> there", "en")]
    [InlineData("Это Windows компьютер", "ru")]
    [InlineData("el gato negro", "es")]
    [InlineData("中国 hello 世界", "cmn")]
    public void AnInputSpanIsEitherInsideTheCallersStringOrAbsent(string text, string lang)
    {
        var t = Phonemizer.PhonemizeTrace(text, lang);
        foreach (var k in t.Tokens)
        {
            if (k.InputSpan is null) continue;
            Assert.InRange(k.InputSpan.Value.Start, 0, text.Length);
            Assert.InRange(k.InputSpan.Value.End, k.InputSpan.Value.Start, text.Length);
        }
    }

    /// <summary>Where normalization changed nothing, a token's source must CONTAIN it (a rule may match wider).</summary>
    [Theory]
    [InlineData("the cat sat on the mat", "en")]
    [InlineData("el gato negro", "es")]
    [InlineData("Obugazi ne Kampala", "lg")]
    [InlineData("Это компьютер", "ru")]
    public void WhereNormalizationChangedNothingTheSourceContainsTheToken(string text, string lang)
    {
        var t = Phonemizer.PhonemizeTrace(text, lang);
        Assert.Equal(text, t.Normalized); // the premise of this test
        var checkedCount = 0;
        foreach (var k in t.Tokens)
        {
            if (k.InputSpan is null) continue;
            checkedCount++;
            Assert.True(k.InputSpan.Value.Start <= k.Start && k.InputSpan.Value.End >= k.End,
                $"{lang}: {k.Surface} span [{k.Start},{k.End}) but inputSpan [{k.InputSpan.Value.Start},{k.InputSpan.Value.End})");
        }
        Assert.True(checkedCount > 0, "no token carried an input span — the probe measured nothing");
    }

    /**
     * ⚠ THE TWO DEFECTS THE OTHER PROVENANCE TESTS COULD NOT SEE, both from "length is not identity".
     *
     * (a) `Mandarin.SubstituteNumbers` rewrites a code-point list OUTSIDE the `JsRe.Replace` seam and is NET
     * length-preserving (`115`→`一百一十五` is +2, each `10`→`十` is −1), so a stale identity mapping passed a
     * length check and reported `十` as coming from a SPACE. In-range and therefore invisible to a bounds
     * assertion, and absent from the containment test because that only runs where normalization is a no-op.
     *
     * (b) `Initialisms` runs `CLASS_BRACKETS.Replace("[aeiouy]", "")` inside a STATIC INITIALIZER — eight
     * characters — and any pipeline string of length 8 adopted its six-entry result. Every language had its
     * own poisoned length, once per process, on the first COLD trace; xunit shares a process, so by the time
     * the other tests ran the initializers were already warm and the defect had evaporated.
     *
     * Both are now caught by tracking the STRING, not its length.
     *
     * ⚠ AND (a) IS NOW READ THE OTHER WAY ROUND. Tracking the string made the wrong span ABSENT; the pass
     * then learned to report its own pieces through `Rebuilt`, so the honest assertion is the STRONGER one —
     * the span is not merely withheld, it is right. What must never come back is the third state: present
     * and wrong.
     */
    [Fact]
    public void ANetLengthPreservingRebuildReportsItsRealSpanNeverAPlausibleOne()
    {
        const string text = "115 10 10 中国";
        var t = Phonemizer.PhonemizeTrace(text, "cmn");
        Assert.Equal(t.Ipa, Phonemizer.Phonemize(text, "cmn"));
        var first = t.Tokens.FirstOrDefault(k => k.Surface.StartsWith("一百", StringComparison.Ordinal));
        Assert.NotNull(first);
        Assert.NotNull(first!.InputSpan);
        Assert.Equal("115", text[first.InputSpan!.Value.Start..first.InputSpan.Value.End]);
        // and nothing anywhere traces to whitespace it did not come from
        foreach (var k in t.Tokens)
            if (k.InputSpan is not null)
                Assert.NotEqual("", text[k.InputSpan.Value.Start..k.InputSpan.Value.End].Trim());
    }

    [Theory]
    [InlineData("hi there")]   // exactly the length of Initialisms' "[aeiouy]"
    [InlineData("the cats")]
    public void APipelineStringThatMerelySHARESALengthIsNotAdopted(string text)
    {
        var t = Phonemizer.PhonemizeTrace(text, "en");
        Assert.Equal(text, t.Normalized); // the premise: normalization is a no-op here
        Assert.NotEmpty(t.Tokens);
        foreach (var k in t.Tokens)
        {
            Assert.NotNull(k.InputSpan);
            Assert.Equal(k.Surface, text[k.InputSpan!.Value.Start..k.InputSpan.Value.End]);
        }
    }

    /**
     * #1150 — `Renormalize`, the seam's second primitive. A normalize is not a replace, and being
     * length-CHANGING it desynced the mapping at the FIRST character with no poison anywhere to say why.
     *
     * ⚠ ITS CORRECTNESS RESTS ON ONE CLAIM: normalization never reaches across a starter, so normalizing
     * canonical blocks separately equals normalizing the whole string. The claim is VERIFIED at runtime
     * rather than trusted, and these two cases pin both sides of that — the ordinary case reports, and the
     * one documented exception withholds instead of guessing.
     */
    [Theory]
    [InlineData("M\u00ecng-ng\u1e73\u0304", NormalizationForm.FormD)]
    [InlineData("caf\u00e9 na\u00efve", NormalizationForm.FormD)]
    [InlineData("cafe\u0301 nai\u0308ve", NormalizationForm.FormC)]
    public void RenormalizeReadsExactlyAsStringNormalize(string src, NormalizationForm form)
    {
        Provenance.Seed(src);
        try
        {
            var got = Rewriter.Renormalize(src, form);
            Assert.Equal(src.Normalize(form), got);
            var p = Provenance.For(got);
            Assert.NotNull(p);
            for (var i = 0; i < got.Length; i++)
            {
                var sp = Provenance.InputSpan(p!, i, i + 1);
                Assert.NotNull(sp);                                  // absent or inside the input,
                Assert.InRange(sp!.Value.Start, 0, src.Length);      // never a span the caller cannot index
                Assert.InRange(sp.Value.End, sp.Value.Start, src.Length);
            }
        }
        finally { Provenance.End(); }
    }

    [Fact]
    public void ACompositionThatReachesAcrossAStarterIsWithheldNotGuessed()
    {
        // `가` (U+AC00, a precomposed LV syllable) plus a trailing T jamo composes into `각` under NFC, and
        // that composition crosses a starter — the one thing the block chunking assumes cannot happen.
        const string src = "\uAC00\u11A8";
        Provenance.Seed(src);
        try
        {
            var got = Rewriter.Renormalize(src, NormalizationForm.FormC);
            Assert.Equal("\uAC01", got);              // the reading is never in doubt
            Assert.Null(Provenance.For(got));         // and the mapping says "not known"
        }
        finally { Provenance.End(); }
    }
}
