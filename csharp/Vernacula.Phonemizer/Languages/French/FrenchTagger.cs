/**
 * French OOV g2p STRUCTURAL tagger — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each letter with
 * its IPA-chunk TAG in a SINGLE forward pass, replacing the rule g2p (g2p.ts) on words the Lexique 3.83 lexicon misses.
 * On a clean Lexique held-out it cuts the OOV phone-error-rate from 5.7% to 0.9% (word-exact 94.9% vs the rule engine's
 * 76.6%), notably reading the silent 3rd-person-plural ⟨-ent⟩/⟨-aient⟩ verb ending the rules wrongly voice as [ɑ̃]
 * (abolissent → abɔlis, not abɔlisɑ̃). French emits IPA directly and marks no lexical stress (the phrase-final accent is
 * added at the group level in french.ts), so the tagger is a thin wrapper over the shared `createWordStructuralTagger`
 * with NO postprocess — just a lowercase+NFC preprocess. A per-letter consonant mask keeps every output plausible.
 *
 * `onnxruntime-node` is an OPTIONAL dependency, imported lazily; if it — or the model — is absent,
 * createFrenchTagger() resolves to `undefined` and the async path (frNeural.ts) falls back to the sync rule engine.
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
            // lowercase + NFC so letters match the training vocab (the sync lexicon/rule paths also lowercase; Lexique
            // words are precomposed é/à…). No postprocess — Lexique IPA carries no stress (added phrase-level in text()).
            Preprocess = w => w.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormC),
        });
}
