/**
 * ASYNC (neural best-path) registry: code → the language's best available async phonemizer.
 * The sync sibling is registry.ts; index.ts routes phonemizeAsync through here. Each entry
 * self-falls-back to the sync engine when `onnxruntime` or its model is absent, so routing
 * here is always safe. Every language entry lives beside its engine in src/languages/<lang>/.
 *
 * ⚠ PORT STATUS: the TS registry wires fourteen codes; this table grows one entry per ported neural
 * language and is installed by Languages/Bootstrap.cs, so an unported one falls through to the sync
 * engine — the same behaviour the TS gives a language it has no entry for.
 */
namespace Vernacula.Phonemizer;

public static class NeuralRegistry
{
    private static readonly Dictionary<string, Func<string, Task<string>>> NEURAL = new(StringComparer.Ordinal)
    {
        // per-grapheme BiLSTM reading the words BOTH af lexicons miss: 91.4% vs the rules' 63.5% word-exact
        // on a dictionary-gold held-out split, because af's residual is stress-conditioned vowel quality —
        // contextual, not tabulable
        ["af"] = Languages.Afrikaans.AfrikaansNeural.PhonemizeAfNeural,
    };

    /**
     * The language's best ASYNC path, or null when its best path is the sync engine.
     *
     * ⚠ THE SHARED PRE-PASSES ARE APPLIED HERE, not in the entries. `phonemize` reaches them because it goes
     * through `getPhonemizer`, which wraps every engine's `text`; the entries below build their engine directly —
     * they have to, since they need constructor arguments and extra `text` arguments the registry's instance does
     * not carry — so they used to reach NONE of them. Measured cost, before this: `phonemizeAsync("سال ۲۰۲۴ ۾",
     * "sd")` was *sˈaːlʊ mˈẽ*, the language's own digits gone; `<i>` was read aloud in every language; `XIV` was
     * read as a word; a vulgar fraction vanished.
     *
     * Applied to the INPUT, before the entry runs, because that is where the sync path applies it: ahead of the
     * tokenizer. The async analogue is ahead of the TAGGER — a tagger handed un-stripped `<i>` tags them as words.
     *
     * The FOREIGN-RUN HOST is the other half and cannot live here: `core/foreign.ts`'s stack is only correct
     * within one synchronous turn, so holding a host across the await would let concurrent callers interleave.
     * Each entry wraps its own synchronous render in `withHost` instead.
     */
    public static Func<string, Task<string>>? GetNeuralPhonemizer(string lang) =>
        NEURAL.TryGetValue(lang, out var neural)
            ? t => neural(Registry.PrePass(lang, t))
            : null;
}
