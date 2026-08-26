/**
 * Fula (ff) phonemizer — Fulfulde, canonical IPA (authored). Longest-match g2p + penultimate stress, no
 * lexicon; the tokenizer accepts BOTH registered scripts, Latin (Boko) and Adlam.
 * Ported from src/languages/fula/fula.ts — see that file for the corpus evidence and every sourcing note.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Fula;

public static class FulaPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Fula word → canonical IPA. Adlam is transliterated to Boko first; the IPA is identical either way. */
    public static string PhonemizeWord(string word) =>
        G2p.PhonemizeWord(FulaAdlam.IsAdlam(word) ? FulaAdlam.AdlamToLatin(word) : word);

    // Fula words in Latin (incl. ɓ ɗ ŋ ɲ ƴ) OR Adlam; the number class covers BOTH registered digit sets,
    // ASCII 0–9 and Adlam 𞥐–𞥙 (U+1E950–1E959), and swallows the comma/dot separators.
    private static readonly string WORD_RUN = HostWord.HostWordRun(new[] { "Latin", "Adlam" });
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({WORD_RUN})|([1-9]\\d{{0,2}}(?:,\\d{{3}})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+[\\u{{1E950}}-\\u{{1E959}}]*|\\d*[\\u{{1E950}}-\\u{{1E959}}]+)|([.!?…,;:])",
        "gu");

    /** This language's OWN inventory — the INVENTORY question, not the script-boundary one. */
    private const string NATIVE_CLASS = "[a-zɓɗŋɲƴñA-ZƁƊŊƝƳÑ\\u{1E900}-\\u{1E94A}]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "je" },
        Percent = new[] { "e teemedere" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dollar" }, ["€"] = new[] { "euro" }, ["¥"] = new[] { "yen" }, ["£"] = new[] { "pound" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometre" }, ["m"] = new[] { "metre" }, ["kg"] = new[] { "kilogram" },
            ["mm"] = new[] { "milimeta" }, ["cm"] = new[] { "santimeta" },
        },
        UnitPer = "e wakkati gootel",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "wakkati", ["s"] = "sahaawa" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kaaree" },
            Cubed = new[] { "kubik" },
            Position = ExponentPosition.After,
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/version steps need
            // the number and its suffix still adjacent, which the tier would break.
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeFula(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // numbers: Adlam digits folded to ASCII, composed to Fula words (quinary 6–9), then g2p
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var n = Js.Number(GROUPING_COMMA.Replace(FulaNumbers.FoldAdlamDigits(m.Groups[2].Value), ""));
                    foreach (var wd in FulaNumbers.NumberToWords(n).Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Fula phonemizer. */
    public static ILanguage CreateFula() => new Engine();

    internal static void RegisterSelf() => Registry.Register("fula", CreateFula);
}
