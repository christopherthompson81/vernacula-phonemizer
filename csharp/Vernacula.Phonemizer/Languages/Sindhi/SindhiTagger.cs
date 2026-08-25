/**
 * Sindhi G2P STRUCTURAL tagger — the neural OOV reader. A per-letter BiLSTM (ONNX) labelling each
 * Perso-Arabic letter with its IPA-chunk TAG, so the model only ever decides the unwritten short vowel.
 * Ported from src/languages/sindhi/sindhiTagger.ts — see that file (and sd-g2p-tagger.PROVENANCE.md) for
 * the training data and the measured accuracies.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sindhi;

public static class SindhiTaggerFactory
{
    /** Build the Sindhi OOV tagger, or `null` if the model / onnxruntime is unavailable. */
    public static Task<IWordStructuralTagger?> CreateSindhiTagger(string basename = "sd-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/sindhi",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Sindhi neural tagging",
            EpEnv = "SD_ORT_EP",
            Preprocess = w => w.Normalize(NormalizationForm.FormC),
        });
}
