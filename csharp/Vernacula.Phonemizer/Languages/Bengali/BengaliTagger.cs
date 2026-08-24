/**
 * Bengali G2P STRUCTURAL tagger — the neural OOV reader.
 * Ported from src/languages/bengali/bengaliTagger.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bengali;

public static class BengaliTagger
{
    /** Build the Bengali OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
    public static Task<IWordStructuralTagger?> CreateBengaliTagger(string basename = "bn-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/bengali",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Bengali neural tagging",
            EpEnv = "BN_ORT_EP",
            Preprocess = w => w.Normalize(System.Text.NormalizationForm.FormC),
        });
}
