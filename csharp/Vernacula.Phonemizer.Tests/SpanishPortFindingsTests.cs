/**
 * Three Spanish defects the Rust port found by reading (#1463), fixed TS-first.
 * Ported from test/spanish-port-findings.test.ts.
 */
using Vernacula.Phonemizer.Core;
using Numbers = Vernacula.Phonemizer.Languages.Spanish.Numbers;
using Normalize = Vernacula.Phonemizer.Languages.Spanish.Normalize;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class SpanishPortFindingsTests
{
    [Fact]
    public void MultiplierApocopatesBeforeMilAndAScaleNoun()
    {
        Assert.Equal("veintiún mil", Numbers.NumberToWords(21000));
        Assert.Equal("treinta y un mil", Numbers.NumberToWords(31000));
        Assert.Equal("ciento un mil", Numbers.NumberToWords(101000));
        Assert.Equal("doscientos un mil", Numbers.NumberToWords(201000));
        Assert.Equal("veintiún millones", Numbers.NumberToWords(21000000));
        Assert.Equal("mil un millones", Numbers.NumberToWords(1001000000));
        Assert.Equal("mil veintiún millones", Numbers.NumberToWords(1021000000));
        // The final group is not a multiplier: it keeps the full form.
        Assert.Equal("veintiún mil veintiuno", Numbers.NumberToWords(21021));
        Assert.Equal("veintiún millones veintiuno", Numbers.NumberToWords(21000021));
        Assert.Equal("veintiuno", Numbers.NumberToWords(21));
        Assert.Equal("mil", Numbers.NumberToWords(1000));
        Assert.Equal("un millón", Numbers.NumberToWords(1000000));
        Assert.Equal("dos millones", Numbers.NumberToWords(2000000));
    }

    [Fact]
    public void MultiplierApocopeEndToEnd()
    {
        Assert.Equal("beᶦntjˈun mˈil aβitˈantes", Phonemizer.Phonemize("21.000 habitantes", "es"));
        Assert.Equal("beᶦntjˈun mˈil peɾsˈonas", Phonemizer.Phonemize("21000 personas", "es-419"));
    }

    [Fact]
    public void ErIndicatorIsTheApocopeOfPrimeroAndTerceroOnly()
    {
        Assert.Equal("el primer lugar", Normalize.NormalizeSpanish("el 1er lugar"));
        Assert.Equal("el tercer día", Normalize.NormalizeSpanish("el 3er día"));
        Assert.Equal("primer", Normalize.NormalizeSpanish("1.er"));
        Assert.Equal("vigésimo primer", Normalize.NormalizeSpanish("21er"));
        Assert.Equal("decimotercer", Normalize.NormalizeSpanish("13er"));
        // Any other number is not an indicator and stays as written (it read *segund*, *quint*).
        Assert.Equal("el 2er", Normalize.NormalizeSpanish("el 2er"));
        Assert.Equal("5er", Normalize.NormalizeSpanish("5er"));
        Assert.Equal("11er", Normalize.NormalizeSpanish("11er"));
        Assert.Equal("dˈos ˈeɾ", Phonemizer.Phonemize("2er", "es"));
    }

    [Fact]
    public void OrdinalTrimsAreNotOnTheProvenanceSeam()
    {
        // ⚠ The `1ª` case is C#-only: FeminineOrdinal called `Rewrite` on each word, where the TypeScript
        // already used a plain replace.
        var poison = new List<string>();
        Provenance.OnPoison((expected, got) => poison.Add($"{expected} vs {got}"));
        try
        {
            Phonemizer.PhonemizeTrace("el 1er lugar", "es");
            Phonemizer.PhonemizeTrace("el 3er día", "es-419");
            Phonemizer.PhonemizeTrace("la 1ª vez", "es");
        }
        finally { Provenance.OnPoison(null); }
        Assert.Empty(poison);
    }
}
