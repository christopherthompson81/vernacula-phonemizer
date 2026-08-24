/**
 * Vietnamese (vi) phonemizer — Northern/Hanoi, canonical IPA.
 * Ported from src/languages/vietnamese/vietnamese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class VietnamesePhonemizer
{
    /** One Vietnamese syllable/word → IPA. */
    public static string PhonemizeWord(string word) => G2p.PhonemizeSyllable(word);

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([a-zà-ỹăâđêôơưÀ-Ỹ̀-̣]+)|(\\d+)|([.!?…,;:])", "giu");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "nhân" },
        Percent = new[] { "phần trăm" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "đô la" }, ["¥"] = new[] { "yên" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "ki lô mét" }, ["mm"] = new[] { "mi li mét" }, ["cm"] = new[] { "xen ti mét" },
            ["kg"] = new[] { "ki lô gam" }, ["m"] = new[] { "mét" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "vuông" }, Cubed = new[] { "khối" } },
    });

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input) =>
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeVietnamese(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    var ipa = G2p.PhonemizeSyllable(m.Groups[1].Value);
                    if (ipa != "") sink.Emit(ipa);
                    else if (_foreign is not null) sink.Emit(_foreign(m.Groups[1].Value));
                }
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in VietnameseNumbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                        sink.Emit(G2p.PhonemizeSyllable(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Vietnamese phonemizer (rule g2p over the closed rhyme set). `foreign` reads tokens that are
     *  not valid Vietnamese syllables — foreign proper nouns — instead of dropping them. */
    public static ILanguage CreateVietnamese(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("vietnamese", () => CreateVietnamese(Registry.ReadAsEnglish));
}
