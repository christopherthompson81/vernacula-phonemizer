/**
 * Norwegian Bokmål OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) whose tag
 * alphabet includes the stress mark, so it predicts stress position and the stress-conditioned vowel quality
 * directly from spelling.
 * Ported from src/languages/norwegian/norwegianTagger.ts — see that file for the evaluation evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Norwegian;

public static class NorwegianTaggerFactory
{
    /** The rule engine's vowel set — passed to the shared `OneStress` so its no-stress fallback places ˈ
     *  before the first Norwegian vowel rather than the fleet default's wider class. */
    private static readonly JsRe VOWEL = JsRegex.Compile("[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u");

    /** Build the Norwegian OOV tagger, or `null` if the model / onnxruntime is unavailable. */
    public static Task<IWordStructuralTagger?> CreateNorwegianTagger(string basename = "nb-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/norwegian",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Norwegian neural tagging",
            EpEnv = "NB_ORT_EP",
            Preprocess = w => Js.ToLowerCase(w).Normalize(NormalizationForm.FormC),
            Postprocess = ipa => StructuralTagger.OneStress(ipa, VOWEL),
        });
}
