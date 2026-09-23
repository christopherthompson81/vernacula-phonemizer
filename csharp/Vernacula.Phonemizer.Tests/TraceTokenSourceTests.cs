/**
 * WHICH TIER RESOLVED A TOKEN (#1453). Ported from test/trace-token-source.test.ts.
 *
 * ⚠ IT EXISTS BECAUSE TWO IDENTICAL NORMALIZED STRINGS READ DIFFERENTLY AND NOTHING COULD SAY WHY —
 * `the τ value` and `the tau value` normalize to the same 13 code points and phonemize differently
 * (#1452). `Span` says where a reading came from, `IpaSpan` where it landed; WHICH TIER produced it had
 * no answer at all.
 *
 * ⚠ THE PORT HAS NO ASYNC TRACE, so `Tagger` is not reachable here — the C# neural path has no traced
 * entry. The sync tiers are what `trace-parity` compares across the two dumps, and they are: measured
 * over the 36,495-row corpus, 13,434 `lexicon`, 111 `g2p` and 96 `heteronym` tokens carry one.
 */
using Vernacula.Phonemizer;
using Vernacula.Phonemizer.Core;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TraceTokenSourceTests
{
    private static Dictionary<string, TokenSource> Sources(string text) =>
        Phonemizer.PhonemizeTrace(text, "en").Tokens
            .GroupBy(t => t.Surface).ToDictionary(g => g.Key, g => g.First().Source);

    [Fact]
    public void NamesTheTierThatAnswered()
    {
        var lex = Sources("hello world");
        Assert.Equal(TokenSource.Lexicon, lex["hello"]);
        Assert.Equal(TokenSource.Lexicon, lex["world"]);

        // A heteronym entry — the reading depended on the POS expectation.
        var het = Sources("read the record");
        Assert.Equal(TokenSource.Heteronym, het["read"]);
        Assert.Equal(TokenSource.Heteronym, het["record"]);

        // A foreign run, read by another language's engine.
        Assert.Equal(TokenSource.Foreign, Sources("λόγος here")["λόγος"]);
    }

    /// ⚠ The SYNC path never consults the tagger, so an OOV word reports `G2p` in both ports. This is the
    /// half the cross-port dump compares; the TS twin covers `Tagger` through its async trace entry.
    [Fact]
    public void AnOovWordReportsTheG2pTier() =>
        Assert.Equal(TokenSource.G2p, Sources("the tau value")["tau"]);
}
