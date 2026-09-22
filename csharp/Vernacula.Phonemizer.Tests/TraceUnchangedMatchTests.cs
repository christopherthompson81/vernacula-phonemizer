/**
 * A REWRITE WHOSE REPLACEMENT EQUALS THE MATCH MUST NOT COLLAPSE THE MAPPING UNDER IT.
 *
 * ⚠ `normalizeRomans` runs over EVERY language and returns most tokens unchanged: it rewrites with
 * `\p{L}+` and hands the token straight back whenever it is not a Roman numeral — which in a
 * NON-SPACING SCRIPT is the whole clause. Stamping the match's span across the replacement mapped
 * every character of `PDFファイルを開いてください` to [0,15), so all three tokens reported the WHOLE
 * INPUT as their InputSpan.
 *
 * ⚠ AND A WHOLE-INPUT SPAN IS WORSE THAN A NULL. `InputSpan`'s contract is "absent means NOT KNOWN,
 * never identical" and a consumer degrades correctly on absent; this is a known-LOOKING answer to an
 * unknown question and passes every count and tiling check a consumer can apply.
 *
 * ⚠ AND THE PARITY GATE CANNOT SEE IT (#1419): parity compares IPA strings, and neither port's
 * readings changed. The TS twin is test/trace-unchanged-match-provenance.test.ts; these two
 * assertions are the only thing holding the C# side to it.
 */
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class TraceUnchangedMatchTests
{
    private const string Mixed = "PDFファイルを開いてください。";

    [Fact]
    public void MapsAnExpandedLatinRunToTheLatinRunNotTheWholeClause()
    {
        var t = Phonemizer.PhonemizeTrace(Mixed, "ja");
        var got = t.Tokens.Select(k => k.InputSpan is null ? "null"
            : Mixed[k.InputSpan.Value.Start..k.InputSpan.Value.End]).ToArray();
        Assert.Equal(new[] { "PDF", "ファイルを", "開いてください", "。" }, got);
    }

    [Fact]
    public void EveryTokenGetsADistinctSpan()
    {
        // ⚠ The consumer's own gate declined on a count mismatch — and here the counts AGREED, every
        // entry pointing at the same span. Degeneracy is invisible to a count check.
        var t = Phonemizer.PhonemizeTrace(Mixed, "ja");
        var spans = t.Tokens.Where(k => k.InputSpan is not null)
            .Select(k => $"{k.InputSpan!.Value.Start},{k.InputSpan.Value.End}").ToList();
        Assert.Equal(spans.Count, spans.Distinct().Count());
    }
}
