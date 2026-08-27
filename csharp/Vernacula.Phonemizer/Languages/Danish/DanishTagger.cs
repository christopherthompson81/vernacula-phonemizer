/**
 * Danish OOV g2p STRUCTURAL tagger — a per-grapheme BiLSTM (ONNX) labelling each letter with its IPA-chunk
 * tag, trained on the full 199k NST and matching its narrow convention.
 * Ported from src/languages/danish/danishTagger.ts — see that file (and da-g2p-tagger.PROVENANCE.md) for
 * the training data and the measured accuracies.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Danish;

public static class DanishTaggerFactory
{
    /** Danish vowel-phoneme set for OneStress's no-stress fallback — incl. ə/ɐ/ɒ beyond the shared default. */
    private static readonly JsRe VOWEL = JsRegex.Compile("[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]", "u");

    /** Build the Danish OOV tagger, or `null` if the model / onnxruntime is unavailable. */
    public static Task<IWordStructuralTagger?> CreateDanishTagger(string basename = "da-g2p-tagger") =>
        StructuralTagger.CreateWordStructuralTagger(new WordTaggerOptions
        {
            Dir = "languages/danish",
            Basename = basename,
            ModelFile = $"{basename}.int8.onnx",
            Context = "Danish neural OOV G2P",
            EpEnv = "DA_ORT_EP",
            Preprocess = w => Js.ToLowerCase(w).Normalize(NormalizationForm.FormC),
            // the per-position argmax has no global stress constraint, so a raw reading can carry
            // zero / doubled / multiple primary marks; normalise to exactly one ˈ like the other two tiers.
            Postprocess = ipa => StructuralTagger.OneStress(ipa, VOWEL),
        });
}
