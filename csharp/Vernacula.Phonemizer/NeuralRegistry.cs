/**
 * ASYNC (neural best-path) registry: code → the language's best available async phonemizer.
 * Ported from src/neuralRegistry.ts — see that file for the corpus evidence.
 */
namespace Vernacula.Phonemizer;

public static class NeuralRegistry
{
    private static readonly Dictionary<string, Func<string, Task<string>>> NEURAL = new(StringComparer.Ordinal)
    {
        ["en"] = text => Languages.English.EnglishNeural.PhonemizeEnNeural(text), // BiLSTM OOV reader (else the sync n-gram OOV G2P)
        // ⚠ THE ACCENT VARIANTS TAKE THE SAME READER (#1260); until this entry existed their async path WAS the sync path.
        ["en-GB"] = text => Languages.English.EnglishNeural.PhonemizeEnNeural(text, "en-GB", Languages.EnglishGb.EnglishGb.RpWordTransform()),
        ["en-IN"] = text => Languages.English.EnglishNeural.PhonemizeEnNeural(text, "en-IN", Languages.EnglishIn.EnglishIn.IndianWordTransform),
        ["af"] = Languages.Afrikaans.AfrikaansNeural.PhonemizeAfNeural,
        ["bn"] = Languages.Bengali.BengaliNeural.PhonemizeBnNeural,
        // per-grapheme BiLSTM reading the words the NST lexicon misses; its tag alphabet embeds the stress
        // mark, which is the deep-orthography win the first-syllable rule heuristic cannot reach
        ["nb"] = Languages.Norwegian.NorwegianNeural.PhonemizeNbNeural,
        ["fr"] = Languages.French.FrenchNeural.PhonemizeFrNeural,
        ["ur"] = t => RiderNeural.PhonemizeRiderNeural(t, "ur"),
        ["fa"] = Languages.Persian.PersianNeural.PhonemizeFaNeural,
        ["sd"] = Languages.Sindhi.SindhiNeural.PhonemizeSdNeural, // per-letter BiLSTM restoring the abjad's unwritten short vowels on OOV words
        // BiLSTM placing the BIZROKE — Sorani's one unwritten vowel — on the words the AsoSoft-derived
        // lexicon misses. Precedence is lexicon → tagger → rules.
        ["ckb"] = Languages.CentralKurdish.CentralKurdishNeural.PhonemizeCkbNeural,
        // ⚠ Western Punjabi (Shahmukhi) is registry code `pnb`, but the rider keys its Perso-Arabic lexicon
        // under `pa` — so the model token and the registry code differ, exactly as in the TS.
        // ⚠ THIS ENTRY WAS MISSING AND NOTHING COULD SEE IT. `pnb`'s SYNC engine is served (it is the same
        // Punjabi engine, and the scanner auto-detects Shahmukhi), so `PhonemizeAsync(…, "pnb")` did not
        // report port-pending — it silently served the sync reading, which is the failure this file's own
        // Bootstrap note warns about. 188 of 200 golden rows differed on restored short vowels alone
        // (*bˈaːəs* for *bˈaːɪs*, *məɦd̪ˈoːd̪* for *məɦd̪ˈuːd̪*). It stayed invisible because pnb had no
        // golden until the mined tier gave it one.
        ["pnb"] = t => RiderNeural.PhonemizeRiderNeural(t, "pa"),
        // per-character BiLSTM restoring the WORD BOUNDARIES Khmer does not write
        ["km"] = Languages.Khmer.KhmerNeural.PhonemizeKmNeural,
        ["he"] = Languages.Hebrew.HebrewNeural.PhonemizeHebrewNeural, // the NAKDAN — restores niqqud on bare Hebrew
        // per-grapheme BiLSTM reading the OOV tail of the deepest European orthography (the ~37k NST lexicon
        // serves the rest); trained on the full 199k NST, ~96% symbol held-out
        ["da"] = Languages.Danish.DanishNeural.PhonemizeDaNeural,
    };

    /** The language's best ASYNC path, or null when its best path is the sync engine. */
    private static readonly Dictionary<string, string?> ARABIC_VARIETY = new(StringComparer.Ordinal)
    {
        ["ar"] = null, ["arz"] = "egyptian", ["apc"] = "levantine", ["ajp"] = "southlevantine", ["apd"] = "sudanese",
        ["acm"] = "iraqi", ["afb"] = "gulf", ["acw"] = "hijazi", ["ary"] = "moroccan", ["ayl"] = "libyan",
    };

    public static Func<string, Task<string>>? GetNeuralPhonemizer(string lang)
    {
        if (ARABIC_VARIETY.TryGetValue(lang, out var variety))
            return t => Languages.Arabic.Arabic.PhonemizeArabic(Registry.PrePass(lang, t), variety, host: lang);
        return NEURAL.TryGetValue(lang, out var neural)
            ? t => neural(Registry.PrePass(lang, t))
            : null;
    }
}
