/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA.
 * Ported from src/languages/korean/korean.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class KoreanPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([가-힣]+)|(\\d+)|([.!?…,;:])", "gu");

    // The UNITS deliberately live in Normalize, not here: they are needed before its range/decimal rules and
    // must be JOINED to the number, while this tier always inserts a space. % and the currency sign stay here.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "곱하기" },
        Percent = Manifest.MANIFEST.SymbolTier.Percent,
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // SYMBOLS FIRST, then NormalizeKorean: % and $ have to see plain ASCII digits, and the decimal
            // rule rewrites 1.5 to 일점오, which would leave a following % with no number to attach to.
            Clauses.AssembleClauses(Normalize.NormalizeKorean(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(G2p.PhonemizeWord(m.Groups[1].Value));
                // NumberToWords returns "" past the JS safe-integer limit rather than compose a confidently
                // wrong reading, so the else-branch below must spell the digits or the number is DELETED.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var words = KoreanNumbers.NumberToWords(Js.Number(m.Groups[2].Value));
                    sink.Emit(G2p.PhonemizeWord(words == "" ? KoreanNumbers.SpellDigits(m.Groups[2].Value) : words));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Korean phonemizer (Hangul g2p + sandhi). */
    public static ILanguage CreateKorean() => new Engine();

    internal static void RegisterSelf() => Registry.Register("korean", CreateKorean);
}
