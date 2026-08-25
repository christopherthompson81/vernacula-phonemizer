/**
 * Indian English (en-IN) — "General Indian English" (GIE), an ACCENT VARIANT of the General-American `en`
 * engine (not a separate language). Reuses the full English G2P (dict + heteronyms + OOV model) and applies a
 * context-free surface DELTA to its output.
 * Ported from src/languages/english-in/english-in.ts — see that file for the phonological sources
 * (Wells 1982 vol. 3; Sailaja 2009) and for what is deliberately DEFERRED.
 *
 * ⚠ THE DELTA IS APPLIED PER WORD, NOT TO THE WHOLE UTTERANCE, and that is a real difference from es-419 and
 * fr-CA, which wrap the assembled output. English's `Text` takes a `wordTransform`, and en-IN threads the
 * remap through it — so the transform sees one word's IPA at a time. Wrapping the utterance instead would
 * expose the delta to clause punctuation and to any inter-word material the assembler adds.
 *
 * ⚠ NO ROMAN POLICY: `en-IN` is in `Registry.ROMAN_NATIVE`, so the shared Roman pass is skipped and English
 * resolves numerals in its own normalization.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.English;

namespace Vernacula.Phonemizer.Languages.EnglishIn;

public static class EnglishIn
{
    // U+0361 COMBINING DOUBLE INVERTED BREVE — the affricate tie. The guard that keeps t͡ʃ / d͡ʒ (church,
    // judge) out of the retroflexion.
    private const string TIE = "͡";

    // ⚠ THE OPTIONAL DIACRITICS ARE INVISIBLE IN A CHARACTER CLASS, so they are written as escapes:
    // U+02B0 MODIFIER LETTER SMALL H (aspiration), U+032C COMBINING CARON BELOW (voiced), U+0330 COMBINING
    // TILDE BELOW (creaky). Written as literals in the TS, where they render as an empty-looking class.
    private static readonly JsRe RETRO_T = JsRegex.Compile($"t[ʰ̬̰]?(?!{TIE})", "gu");
    private static readonly JsRe RETRO_D = JsRegex.Compile($"d[̬̰]?(?!{TIE})", "gu");

    /** GenAm citation IPA → General Indian English (context-free; no lexical sets needed). */
    public static string ToIndian(string genAm)
    {
        // RETROFLEXION of /t d/ → [ʈ ɖ], guarded against the tied affricates. ⚠ RUNS BEFORE TH-STOPPING so the
        // dental stops [t̪ d̪] created below are not swept up by it.
        var s = RETRO_D.Replace(RETRO_T.Replace(genAm, "ʈ"), "ɖ");
        // TH-STOPPING → dental stops (after retroflexion; distinct from ʈ/ɖ by PLACE, so "thin" ≠ "tin").
        s = s.Replace("θ", "t̪ʰ").Replace("ð", "d̪");
        // MONOPHTHONGISATION of FACE/GOAT; other offglides → plain [ɪ]/[ʊ] (PRICE/MOUTH/CHOICE stay diphthongs).
        s = s.Replace("eᶦ", "eː").Replace("oᶷ", "oː");
        s = s.Replace("aᶦ", "aɪ").Replace("aᶷ", "aʊ").Replace("ᶦ", "ɪ").Replace("ᶷ", "ʊ");
        // /v/–/w/ MERGER → [ʋ].
        s = s.Replace("v", "ʋ").Replace("w", "ʋ");
        // DE-ASPIRATION of the remaining voiceless stops (/t/ already de-aspirated via retroflexion).
        s = s.Replace("pʰ", "p").Replace("kʰ", "k");
        // CLEAR /l/ (drop the dark-coda diacritic).
        s = s.Replace("ɫ", "l");
        // RHOTIC WITH A TAP: de-rhoticise the r-coloured vowels to V+[ɾ], then every /ɹ/ → [ɾ]. The coda is
        // KEPT — GIE is rhotic, unlike en-GB.
        s = s.Replace("ɝ", "əɾ").Replace("ɚ", "əɾ").Replace("ɹ", "ɾ");
        // Fuller vowels: reduced [ᵻ]/[ᵿ] → [ɪ]/[ʊ]; drop the palatal on-glide [ʲ].
        return s.Replace("ᵻ", "ɪ").Replace("ᵿ", "ʊ").Replace("ʲ", "");
    }

    private static EnglishPhonemizer? IN;
    private static EnglishPhonemizer Eng() => IN ??= EnglishFactory.CreateEnglish();

    /** One en-IN word → canonical IPA. Context-free, so the shipped path IS the rule path. */
    public static string PhonemizeWord(string word) => ToIndian(Eng().Text(word));

    /** Alias kept for parity with the variants (en-GB/pt-BR) that split a lexicon-bearing shipped path. */
    public static string PhonemizeWordRules(string word) => PhonemizeWord(word);

    private sealed class EnInLanguage(EnglishPhonemizer inner) : ILanguage
    {
        public string Text(string input) => inner.Text(input, (ipa, _) => ToIndian(ipa), null);
    }

    /** Build the Indian-English phonemizer (GenAm engine + the GIE delta on each WORD's output). */
    public static ILanguage CreateEnglishIN() => new EnInLanguage(EnglishFactory.CreateEnglish());

    internal static void RegisterSelf() => Registry.Register("english-in", CreateEnglishIN);
}
