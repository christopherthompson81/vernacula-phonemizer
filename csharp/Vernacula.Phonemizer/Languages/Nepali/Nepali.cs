/**
 * Native Nepali / नेपाली (ne) text phonemizer — canonical IPA. Reuses the generic Hindi engine
 * (MakeNativeHindi) with a Nepali manifest, its OWN normalizer and its OWN symbol words.
 * Ported from src/languages/nepali/nepali.ts — see that file for the divergences from Hindi and the
 * ne_np corpus evidence behind each overridden and each deliberately-kept symbol tier cell.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Nepali;

public static class NepaliPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/nepali", "nepali.jsonc");

    private static readonly Func<string, string> NE_SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "र",
        Multiply = new MultiplyDef { Times = "गुणा" },
        Percent = new[] { "प्रतिशत" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "किलोमीटर" }, ["किमि"] = new[] { "किलोमीटर" }, ["किमी"] = new[] { "किलोमीटर" },
            ["cm"] = new[] { "सेन्टिमिटर" }, ["mm"] = new[] { "मिलीमीटर" }, ["kg"] = new[] { "किलोग्राम" },
            ["m"] = new[] { "मिटर" },
        },
        UnitPer = "प्रति",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "घण्टा", ["s"] = "सेकेण्ड" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "वर्ग" }, Cubed = new[] { "घन" }, Position = "before",
        },
    });

    /** U+E000 — the private-use sentinel that shields an EMBEDDED-Latin run's contrastive /ə/ from the
     *  Devanagari ə→ʌ map below. */
    private const string SENTINEL = Markers.PUA_SENTINEL;
    private static readonly JsRe SCHWA = JsRegex.Compile("ə", "gu");

    /** The Devanagari inherent/independent vowel stays ə through the shared schwa-deletion, then surfaces
     *  as the Nepali [ʌ]. */
    private static string NepaliVowel(string s) => SCHWA.Replace(s, "ʌ");

    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null)
    {
        ForeignPhonemizer? shieldedForeign = foreign is null ? null : latin => SCHWA.Replace(foreign(latin), SENTINEL);
        var b = Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), shieldedForeign, null, null,
            normalizeOverride: Normalize.MakeNepaliNormalizer(DEF.Numbers),
            symbolsOverride: NE_SYMBOLS);
        return new NativeHindiEngine
        {
            Word = w => NepaliVowel(b.Word(w)),
            WordRules = w => NepaliVowel(b.WordRules(w)),
            Number = d => NepaliVowel(b.Number(d)),
            // Map Devanagari ə→ʌ, then restore the shielded English ə (computer stays kəmpjuːt̬ɚ).
            // ⚠ A whole-string post-pass, reported to the trace (#1150).
            Text = i =>
            {
                var pre = b.Text(i);
                var o = NepaliVowel(pre).Replace(SENTINEL, "ə", StringComparison.Ordinal);
                Core.Trace.// ⚠ POSITIONAL (#1150 stage 3): one character for one, so the output spans survive it.
            NoteRewrite("nepali-inherent-vowel", pre, o, true);
                return o;
            },
        };
    }

    /** Build the Nepali phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateNepali(ForeignPhonemizer? foreign = null) => Engine(foreign);

    private static NativeHindiEngine? NE;
    /** Bare word→IPA (tests / eval). */
    public static string PhonemizeWord(string w) => (NE ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("nepali", () => new NativeHindiLanguage(CreateNepali(latin => Registry.ReadAsEnglish(latin))));
}
