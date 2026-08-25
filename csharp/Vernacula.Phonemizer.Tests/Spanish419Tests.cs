/**
 * Latin-American Spanish (es-419) — the Castilian engine plus seseo (θ→s) and yeísmo (ʎ→ʝ).
 * Ported from src/languages/spanish-419/spanish-419.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH is not the substitution — the golden covers that — but the REGISTRATION.
 * `Registry.Build` routed `es-419` to a factory key nothing registered, so every call threw
 * `port pending: spanish-419`, and no golden existed for the gate to notice with.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class Spanish419Tests
{
    [Fact]
    public void TheVariantIsRegisteredAtAll()
    {
        // The whole defect: this threw NotImplementedException while `es` answered normally.
        Assert.False(string.IsNullOrEmpty(Phonemizer.Phonemize("hola", "es-419")));
    }

    [Fact]
    public void SeseoAndYeismoAreApplied()
    {
        // cerveza: Castilian θ twice → s. calle: Castilian ʎ → ʝ.
        Assert.Contains("θ", Phonemizer.Phonemize("cerveza", "es"));
        Assert.DoesNotContain("θ", Phonemizer.Phonemize("cerveza", "es-419"));
        Assert.DoesNotContain("ʎ", Phonemizer.Phonemize("calle", "es-419"));
        Assert.Equal(
            Phonemizer.Phonemize("cerveza", "es").Replace("θ", "s").Replace("ʎ", "ʝ"),
            Phonemizer.Phonemize("cerveza", "es-419"));
    }

    [Fact]
    public void TheAmericasDateRuleIsSelected()
    {
        // ⚠ NOT DECORATION: `americas: true` is the only thing spanish.jsonc's `months` table is read
        // for. Spain says *el uno de enero*, America *el primero de enero*.
        Assert.NotEqual(Phonemizer.Phonemize("El 1 de enero", "es"), Phonemizer.Phonemize("El 1 de enero", "es-419"));
    }

    [Fact]
    public void NumeralWordsAreIdenticalToEs()
    {
        // The RAE *Ortografía* is co-published with the Asociación de Academias, so the Roman policy is
        // the SAME object, not a copy. Only the phonology differs — fold it out and the two must agree.
        var es = Phonemizer.Phonemize("XXI aniversario", "es").Replace("θ", "s").Replace("ʎ", "ʝ");
        Assert.Equal(es, Phonemizer.Phonemize("XXI aniversario", "es-419"));
    }
}
