/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA (AUTHORED).
 * Ported from src/languages/hausa/hausa.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class HausaPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly string LATIN_WITH_APOSTROPHE = HostWord.HostWordRun(new[] { "Latin" }, "'’");
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({LATIN_WITH_APOSTROPHE})|([1-9]\\d{{0,2}}(?:,\\d{{3}})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zɓɗƙƴA-ZƁƊƘƳ'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");
    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "g");
    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        ExponentWords = Manifest.MANIFEST.SymbolTier.ExponentWords,
        Multiply = Manifest.MANIFEST.SymbolTier.Multiply,
        PercentPrefix = Manifest.MANIFEST.SymbolTier.PercentPrefix,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // Normalize FIRST, then the shared symbol tier — normalize's era/version/rate steps need the
            // number and its suffix still adjacent, which the tier would break.
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeHausa(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(G2p.PhonemizeWord(JsRegex.Replace(Nat(m.Groups[1].Value), CURLY_APOSTROPHE, _ => "'")));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ `NumberToWords` RETURNS "" above its authored 10¹² range, and emitting that would
                    // delete the number from the reading with nothing to hear. Fall back to digit-at-a-time.
                    var bare = JsRegex.Replace(m.Groups[2].Value, GROUPING_COMMA, _ => "");
                    var composed = HausaNumbers.NumberToWords(Js.Number(bare));
                    var words = composed == ""
                        ? Js.CodePoints(bare).Select(c => HausaNumbers.NumberToWords(Js.Number(c))).ToList()
                        : composed.Split(' ').ToList();
                    foreach (var wd in words) if (wd != "") sink.Emit(G2p.PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Hausa phonemizer (authored Boko g2p + tone lexicon). */
    public static ILanguage CreateHausa() => new Engine();

    internal static void RegisterSelf() => Registry.Register("hausa", CreateHausa);
}
