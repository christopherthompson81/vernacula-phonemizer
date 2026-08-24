/**
 * Vietnamese (vi) phonemizer — Northern/Hanoi, canonical IPA. Vietnamese is written as
 * space-separated monosyllables; each syllable → onset + glide + nucleus + tone + coda (g2p.ts). Tones are
 * Chao contour letters after the nucleus. text() tokenizes syllables / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class VietnamesePhonemizer
{
    /** One Vietnamese syllable/word → IPA. */
    public static string PhonemizeWord(string word) => G2p.PhonemizeSyllable(word);

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // A Vietnamese syllable (letters incl. precomposed diacritics + combining marks), a number, or clause punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile("([a-zà-ỹăâđêôơưÀ-Ỹ̀-̣]+)|(\\d+)|([.!?…,;:])", "giu");

    // symbol normalization — Vietnamese: unit words emitted as SEPARATE SYLLABLES (ki lô mét), because
    // the engine phonemizes per syllable and "kilômét" is not one valid syllable.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
        // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
        // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
        // omitted and defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "nhân" },
        Percent = new[] { "phần trăm" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "đô la" }, ["¥"] = new[] { "yên" },
        },
        // `m` = mét is safe here because the tier requires a NUMBER immediately to the left and no letter to
        // the right; the longer keys are matched first, so km/mm/cm are never split. Attested after a digit
        // in the corpus as "(30 m)" and "133 m/giây".
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "ki lô mét" }, ["mm"] = new[] { "mi li mét" }, ["cm"] = new[] { "xen ti mét" },
            ["kg"] = new[] { "ki lô gam" }, ["m"] = new[] { "mét" },
        },
        // MIGRATION TEST: squared units composed by the shared tier. Vietnamese puts the measure word
        // AFTER the unit and has no count agreement, so one form suffices.
        ExponentWords = new ExponentWordsDef { Squared = new[] { "vuông" }, Cubed = new[] { "khối" } },
    });

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign) => _foreign = foreign;

        public string Text(string input) =>
            // ORDER: normalize.ts FIRST, then the shared symbol tier. Every rewrite in normalize.ts is
            // written to preserve the digits↔unit adjacency the symbol tier matches on (783.562 km² becomes
            // 783.562 km vuông, not 783.562 vuông km), so the tier still sees "<number> km" afterwards.
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeVietnamese(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    // A token that is not a valid Vietnamese syllable (paris, sofia, facebook) used to return ""
                    // and vanish from the output. Route it through `foreign` (English) instead — code-switched
                    // proper nouns are pervasive in Vietnamese text, and a missing word is worse than an
                    // English-phoneme one.
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
