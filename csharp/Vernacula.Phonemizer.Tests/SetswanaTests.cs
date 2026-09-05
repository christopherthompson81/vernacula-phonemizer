// The portable half of test/setswana.test.ts — Setswana (tn), Bantu S31 over the Latin orthography.
// Tone is lexical, unwritten and DEFERRED, so the output is segmental.
//
// ⚠ tn HAS NO FLEURS SPLIT (verified, not assumed — the catalogue says `fleurs 0` and there is no `tn`
// transcript directory), so PORTING.md's corpus-wide differential is unavailable and the weight falls on
// these plus the off-golden probes. See docs/investigations/tn/tn_port_investigation.md.
using Vernacula.Phonemizer;
using TnEngine = Vernacula.Phonemizer.Languages.Setswana.SetswanaPhonemizer;
using TnNormalize = Vernacula.Phonemizer.Languages.Setswana.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SetswanaTests
{
    private static string Say(string s) => Phonemizer.Phonemize(s, "tn").Trim();
    private static string Words(string s) => TnNormalize.NormalizeSetswanaPost(TnNormalize.NormalizeSetswanaPre(s));

    [Theory]
    // Digraph signatures: dorsal aspirates, lateral affricates, sibilants, palatals.
    [InlineData("kgomo", "k͡χʰʊmʊ")]
    [InlineData("kgosi", "k͡χʰʊsi")]
    [InlineData("tlhogo", "t͡ɬʰʊχʊ")]
    [InlineData("tshaba", "t͡sʰaba")]
    [InlineData("batswana", "bat͡swana")]
    [InlineData("motho", "mʊtʰʊ")]
    [InlineData("dijo", "did͡ʒʊ")]
    // The ⟨g⟩ → [χ] uvular divergence — Setswana has NO /g/ phoneme.
    [InlineData("legodimo", "lɪχʊdimʊ")]
    [InlineData("segolo", "sɪχʊlʊ")]
    [InlineData("nyaga", "ɲaχa")]
    // The nasals.
    [InlineData("ngwana", "ŋwana")]
    [InlineData("senya", "sɪɲa")]
    // The 7-vowel system: ⟨e⟩→ɪ, ⟨o⟩→ʊ, and the ê/ô open-mid pair.
    [InlineData("dumela", "dumɪla")]
    [InlineData("tsela", "t͡sɪla")]
    [InlineData("bola", "bʊla")]
    [InlineData("bôla", "bɔla")]        // the minimal pair against `bola`
    [InlineData("mmele", "mmɪlɪ")]      // syllabic ⟨m⟩ onset
    [InlineData("ntlha", "nt͡ɬʰa")]     // nasal + the ⟨tlh⟩ trigraph
    public void TheGreedyScan(string word, string want) => Assert.Equal(want, TnEngine.PhonemizeWord(word));

    [Theory]
    // Cardinals: the bo-counting series, the two-word bofera forms, and descending composition with ⟨le⟩.
    [InlineData("1", "bʊŋwɪ")]
    [InlineData("8", "bʊfɪra bʊbɪdi")]
    [InlineData("10", "lɪsʊmɪ")]
    [InlineData("15", "lɪsʊmɪ lɪ bʊt͡ɬʰanʊ")]
    [InlineData("20", "masʊmɪ a mabɪdi")]
    [InlineData("21", "masʊmɪ a mabɪdi lɪ bʊŋwɪ")]
    [InlineData("100", "lɪk͡χʰʊlʊ")]
    [InlineData("1000", "sɪkɪtɪ")]
    [InlineData("2025", "dikɪtɪ t͡sɪ pɪdi lɪ masʊmɪ a mabɪdi lɪ bʊt͡ɬʰanʊ")]
    public void TheCardinalComposer(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // PERCENT is postposed `mo lekgolong` — the form the corpus glosses against the digits.
    [InlineData("77%", "masʊmɪ a supaŋ lɪ bʊsupa mʊ lɪk͡χʰʊlʊŋ")]
    [InlineData("2%", "bʊbɪdi mʊ lɪk͡χʰʊlʊŋ")]
    // CURRENCY: four signs read, the euro deliberately silent.
    [InlineData("$5", "didʊlara di lɪ bʊt͡ɬʰanʊ")]
    [InlineData("US$5", "didʊlara di lɪ bʊt͡ɬʰanʊ")]   // the compound key, or `US` reads as a word
    [InlineData("£6", "dipʊntʊ di lɪ bʊratarʊ")]
    [InlineData("P10", "dipula di lɪ lɪsʊmɪ")]
    [InlineData("€10", "lɪsʊmɪ")]                      // ×0 attestation for the word — the sign stays silent
    // UNITS read with the measure noun FIRST and its concord copula.
    [InlineData("15 km", "dikilʊmɪtara di lɪ lɪsʊmɪ lɪ bʊt͡ɬʰanʊ")]
    [InlineData("100 m", "dimɪtara di lɪ lɪk͡χʰʊlʊ")]
    [InlineData("200km", "dikilʊmɪtara di lɪ mak͡χʰʊlʊ a mabɪdi")]
    [InlineData("km", "dikilʊmɪtara")]                 // standalone → the BARE citation form, no copula
    // The exponents: squared is preposed, cubed is the fused compound on its own key.
    [InlineData("604 km2", "sɪkwɪrɪ sa dikilʊmɪtara di lɪ mak͡χʰʊlʊ a maratarʊ lɪ bʊnɪ")]
    [InlineData("13 m3", "dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ")]
    [InlineData("13 m³", "dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ")]
    // A rate composes with `ka`.
    [InlineData("97 km/h", "dikilʊmɪtara di lɪ masʊmɪ a fɪraŋ bʊŋwɪ lɪ bʊsupa ka ura")]
    [InlineData("5 m/s", "dimɪtara di lɪ bʊt͡ɬʰanʊ ka mʊt͡sʊt͡swana")]
    // DEGREES: the scale letter no longer reaches the g2p as a phoneme.
    [InlineData("40 °C", "dikirii t͡sa kɪlkius di lɪ masʊmɪ a manɪ")]
    [InlineData("5 °F", "dikirii t͡sa fahrɪnhɪit di lɪ bʊt͡ɬʰanʊ")]
    [InlineData("26°", "dikirii di lɪ masʊmɪ a mabɪdi lɪ bʊratarʊ")]
    [InlineData("−6 °C", "dikirii t͡sa kɪlkius t͡sɪ di kwa t͡ɬasɪ χa lɪfɪla di lɪ bʊratarʊ")]
    // RANGES take `go ya go`, ascending only.
    [InlineData("15–49", "lɪsʊmɪ lɪ bʊt͡ɬʰanʊ χʊ ja χʊ masʊmɪ a manɪ lɪ bʊfɪra bʊŋwɪ")]
    // The English ordinal suffix is stripped rather than read as a phoneme.
    [InlineData("20th", "masʊmɪ a mabɪdi")]
    public void TheWholePipeline(string input, string want) => Assert.Equal(want, Say(input));

    [Theory]
    // SEPARATORS: three grouping conventions de-grouped, two decimal marks spelled with `ntlha`.
    [InlineData("1.766", "1766")]
    [InlineData("18 443", "18443")]
    [InlineData("604.3", "604 ntlha 3")]
    [InlineData("3,4", "3 ntlha 4")]
    [InlineData("0.001", "0 ntlha 0 0 1")]   // the leading-zero long tail — its own arm
    [InlineData("9.75", "9 ntlha 7 5")]
    // RANGES, and everything the ascending guard declines.
    [InlineData("457 - 474", "457 go ya go 474")]
    [InlineData("2016-17", "2016-17")]       // a SEASON is descending by construction
    [InlineData("40-0", "40-0")]             // a football score
    [InlineData("ISBN 1-58479-341-4", "ISBN 1-58479-341-4")] // a hyphen CHAIN
    // ⚠ a clause-final range still takes its joiner (trap 58).
    [InlineData("486–501.", "486 go ya go 501.")]
    [InlineData("2005-2006.", "2005 go ya go 2006.")]
    [InlineData("1940-1947?", "1940 go ya go 1947?")]
    // THE CLOCK needs a marker; a sports time never has one.
    [InlineData("7:00 p.m.", "diura di le 7 thapama")]
    [InlineData("6:19 p.m.", "diura di le 6 le metsotso e le 19 thapama")]
    [InlineData("7:00 a.m.", "diura di le 7 mo mosong")]
    [InlineData("1:30 mo mosong", "diura di le 1 le metsotso e le 30 mo mosong")] // re-emitted, not consumed
    [InlineData("11:51", "11:51")]
    [InlineData("2:54.47", "2:54 ntlha 4 7")] // the colon stays a pause; only the decimal reads
    [InlineData("01:04:02", "01:04:02")]
    [InlineData("UTC+02:00", "UTC+02:00")]
    // The English ordinal suffix, and the token that is not one.
    [InlineData("3rd", "3")]
    [InlineData("11De", "11De")]
    public void TheNormalizer(string input, string want) => Assert.Equal(want, Words(input));

    /** ⚠ The one-letter key `m` must not claim a dotted designation — the guard works by SEEING the dot, and
     *  this layer's decimal rule runs AFTER the tier, which is what keeps it alive. */
    [Fact]
    public void TheOneLetterKeyDeclinesAVersionString()
    {
        Assert.DoesNotContain("dimɪtara", Say("802.11m"), StringComparison.Ordinal);
        Assert.Contains("dimɪtara di lɪ", Say("6.5m"), StringComparison.Ordinal);
    }

    /** A denominator is never a standalone unit — `Il-76s` is not seventy-six seconds. */
    [Fact]
    public void ADenominatorIsNeverStandalone() =>
        Assert.DoesNotContain("mʊt͡sʊt͡swana", Say("76s"), StringComparison.Ordinal);

    /** The rand needs an AMOUNT, not just the sign: a bare 1–3 digit integer is a South African ROAD. */
    [Fact]
    public void TheRandGuardIsTheAmountNotTheSign()
    {
        Assert.Contains("diranta di lɪ", Say("R268.26"), StringComparison.Ordinal);
        Assert.Contains("diranta di lɪ bʊŋwɪ", Say("R1 billion"), StringComparison.Ordinal);
        Assert.DoesNotContain("diranta", Say("tsela ya R59"), StringComparison.Ordinal);
    }

    /** Entities are folded before anything else, and `&` is the manifest's own conjunction. */
    [Fact]
    public void EntitiesFoldFirst()
    {
        Assert.Equal("A B", TnNormalize.NormalizeSetswanaPre("A&nbsp;B"));
        Assert.Contains("sɪkwɪrɪ sa dikilʊmɪtara", Say("1400&nbsp;km²"), StringComparison.Ordinal);
        Assert.Contains(" lɪ ", Say("Food & Agriculture"), StringComparison.Ordinal);
    }

    /** Ordinary Setswana text is untouched by either pass. */
    [Fact]
    public void OrdinaryTextIsUntouched()
    {
        const string plain = "Ke motse o mogolo mo Botswana mme batho ba gone ba bua Setswana.";
        Assert.Equal(plain, Words(plain));
    }

    /** No digit leak, sentinel or gap anywhere in the composer's dense range. */
    [Fact]
    public void NoLeakAcrossTheDenseRange()
    {
        for (var n = 0; n < 1_000_000; n += 7)
        {
            var w = Languages.Setswana.Numbers.NumberToWords(n, n.ToString());
            Assert.False(w.Contains("undefined") || w.Contains("NaN") || w.Any(char.IsAsciiDigit), $"n={n}");
        }
    }
}
