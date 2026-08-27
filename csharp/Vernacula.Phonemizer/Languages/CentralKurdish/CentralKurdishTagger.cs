/**
 * Central Kurdish BIZROKE tagger — the neural OOV tier for Sorani's one unwritten vowel. A per-symbol
 * BiLSTM (ONNX) labelling each code point of THIS ENGINE'S OWN RULE OUTPUT with either itself or itself + /ɪ/.
 * Ported from src/languages/central-kurdish/centralKurdishTagger.ts — see that file (and
 * ckb-bizroke-tagger.PROVENANCE.md) for the training data, the accuracies, and why there is no postprocess.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CentralKurdish;

public static class CentralKurdishTaggerFactory
{
    /** Build the ckb bizroke tagger, or `null` if the model / onnxruntime is unavailable. */
    public static Task<IWordStructuralTagger?> CreateCentralKurdishTagger(string basename = "ckb-bizroke-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/central-kurdish",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Central Kurdish neural tagging",
            EpEnv = "CKB_ORT_EP",
            // ⚠ the tagger reads IPA, not orthography. An unseen symbol has no entry in `src`, so the shared
            // factory declines the word and the rule reading stands.
            Preprocess = CentralKurdishPhonemizer.PhonemizeWordRules,
        });
}
