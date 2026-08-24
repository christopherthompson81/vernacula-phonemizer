/**
 * Afrikaans OOV g2p STRUCTURAL tagger — the neural OOV reader.
 * Ported from src/languages/afrikaans/afrikaansTagger.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Afrikaans;

public static class AfrikaansTaggerFactory
{
    /** Build the Afrikaans OOV tagger, or `null` if the model / onnxruntime is unavailable. */
    public static Task<IWordStructuralTagger?> CreateAfrikaansTagger(string basename = "af-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/afrikaans",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Afrikaans neural tagging",
            EpEnv = "AF_ORT_EP",
            Preprocess = w => w.ToLowerInvariant().Normalize(NormalizationForm.FormC),
        });
}
