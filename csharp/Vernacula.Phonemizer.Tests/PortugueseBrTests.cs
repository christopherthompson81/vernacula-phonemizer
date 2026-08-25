/**
 * Brazilian Portuguese (pt-BR) — the EP engine in `dialect: "bp"` mode plus the open/close lexicon.
 * Ported from src/languages/portuguese-br/portuguese-br.ts.
 *
 * ⚠ WHAT THIS EXISTS TO CATCH is the REGISTRATION and the LEXICON LOAD, not the phonology — the golden
 * covers that. `Registry.Build` routed `pt-BR` to a factory key nothing registered, and a variant whose
 * lexicon silently fails to load still answers plausibly, in the base engine's voice.
 */
using Vernacula.Phonemizer;
using Xunit;

namespace Vernacula.Phonemizer.Tests;

public class PortugueseBrTests
{
    [Fact]
    public void TheVariantIsRegisteredAtAll()
    {
        Assert.False(string.IsNullOrEmpty(Phonemizer.Phonemize("cidade", "pt-BR")));
    }

    [Fact]
    public void TheBrazilianDeltaIsApplied()
    {
        // Four signatures of the BP mode, each absent from EP:
        Assert.Contains("d͡ʒ", Phonemizer.Phonemize("dia", "pt-BR"));        // /d/ affricates before [i]
        Assert.Contains("w", Phonemizer.Phonemize("sal", "pt-BR"));          // coda /l/ vocalizes
        Assert.DoesNotContain("ʃ", Phonemizer.Phonemize("estado", "pt-BR")); // coda sibilant is alveolar
        Assert.DoesNotContain("ɨ", Phonemizer.Phonemize("telefone", "pt-BR")); // no EP [ɨ]
        // …and EP still has them, so this is a delta and not a global change.
        Assert.Contains("ʃ", Phonemizer.Phonemize("estado", "pt"));
    }

    [Fact]
    public void TheOpenCloseLexiconIsActuallyLoaded()
    {
        // ⚠ THE FAILURE THIS GUARDS IS SILENT. `LoadTsvMap(optional: true)` returns an EMPTY map when the
        // file is not found, and the engine then answers with the rule-only reading — plausible IPA in the
        // right language, just the wrong stressed vowel. Nothing throws. `abacote` is a lexicon entry whose
        // target (ɔ) the rules do not produce, so its presence proves the file was read.
        Assert.Contains("ɔ", Phonemizer.Phonemize("abacote", "pt-BR"));
        // The rule-only path is what the referee eval scores; it must NOT carry the override.
        Assert.NotEqual(
            Languages.PortugueseBr.PortugueseBr.PhonemizeWordRules("abacote"),
            Languages.PortugueseBr.PortugueseBr.PhonemizeWord("abacote"));
    }

    [Fact]
    public void TheRomanPolicyIsRegisteredForTheVariantToo()
    {
        // pt-BR differs in phonology, not in the numeral lexicon, and shares the ordinal-≤X convention — the
        // same policy OBJECT is registered, not a copy. Without that registration the shared Roman pass would
        // fall back to the cardinal, so the test is that the ordinal is reached: `XII aniversário` must not
        // read like `12 aniversário`.
        Assert.NotEqual(
            Phonemizer.Phonemize("12 aniversário", "pt-BR"),
            Phonemizer.Phonemize("XII aniversário", "pt-BR"));
        // …and `pt` reaches the same DECISION on the same input — the two must agree on word count even
        // though every word differs phonologically. (Comparing the IPA itself would only re-test the delta.)
        Assert.Equal(
            Phonemizer.Phonemize("XII aniversário", "pt").Split(' ').Length,
            Phonemizer.Phonemize("XII aniversário", "pt-BR").Split(' ').Length);
        Assert.NotEqual(
            Phonemizer.Phonemize("XII aniversário", "pt"),
            Phonemizer.Phonemize("XII aniversário", "pt-BR"));
    }
}
