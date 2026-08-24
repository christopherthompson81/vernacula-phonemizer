/**
 * French OOV g2p STRUCTURAL tagger — the neural OOV reader.
 * Ported from src/languages/french/frenchTagger.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class FrenchTagger
{
    /** Build the French OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
    public static Task<IWordStructuralTagger?> CreateFrenchTagger(string basename = "fr-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/french",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "French neural OOV G2P",
            EpEnv = "FR_ORT_EP",
            Preprocess = w => w.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormC),
        });
}
