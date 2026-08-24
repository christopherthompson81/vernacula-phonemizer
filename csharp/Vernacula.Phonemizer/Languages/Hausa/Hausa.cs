/**
 * Hausa (ha) phonemizer — Kano standard, canonical IPA (AUTHORED). Boko-
 * orthography g2p (g2p.ts) + penultimate stress + a Wiktionary-derived tone lexicon. text() tokenizes Hausa
 * words (incl. ɓ ɗ ƙ ƴ and apostrophe as a letter) / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hausa;

public static class HausaPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // Hausa Boko letters incl. ɓ ɗ ƙ ƴ (and their capitals) + apostrophe (a letter: 'yan, 'a'a).
    // the corpus groups thousands with COMMAS (6,387, 783,562) and writes decimals with DOTS (1.5,
    // 12.8); the TOKEN swallows the separators so the tier can still see the number next to its unit/sign.
    private static readonly string LATIN_WITH_APOSTROPHE = HostWord.HostWordRun(new[] { "Latin" }, "'’");
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({LATIN_WITH_APOSTROPHE})|(\\d{{1,3}}(?:,\\d{{3}})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     */
    private const string NATIVE_CLASS = "[a-zɓɗƙƴA-ZƁƊƘƳ'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");
    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "g");
    private static readonly JsRe GROUPING_COMMA = JsRegex.Compile(",", "gu");

    // symbol normalization — Hausa: % is "kashi" BEFORE the number (the corpus's "kashi 80%"); nouns
    // stay SINGULAR after numerals; the unit words are the corpus's own borrowings (kilomita, mita).
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
        // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
        // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
        // omitted and defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "sau" },
        Percent = new[] { "kashi" },
        PercentPrefix = true,
        // `dala` is the Hausa dollar, and the corpus proves it in the two places it names the currency —
        // "dalar Amurka" and "biliyoyin dalolin Amurka". The shipped `dollar` was the English spelling and is
        // attested nowhere; the review tool's sourcing line flags exactly that. (`dala` is polysemous — it is
        // also "pyramid", which is what four of its seven corpus hits are — but the tier only emits it after a
        // currency sign, so the other sense cannot be reached.) `yen` is the standard borrowing and the corpus
        // does write ¥ ×2, but the word itself is unattested here: a stated assumption, not a source.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dala" }, ["€"] = new[] { "euro" }, ["¥"] = new[] { "yen" }, ["£"] = new[] { "fam" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomita" }, ["m"] = new[] { "mita" }, ["kg"] = new[] { "kilogram" },
            ["mm"] = new[] { "milimita" }, ["cm"] = new[] { "santimita" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "murabba'i" }, Cubed = new[] { "cubic" } },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // normalize.ts FIRST, then the shared symbol tier — normalize's era/version/rate steps need the
            // number and its suffix still adjacent, which the tier would break.
            Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeHausa(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(G2p.PhonemizeWord(JsRegex.Replace(Nat(m.Groups[1].Value), CURLY_APOSTROPHE, _ => "'")));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // ⚠ `numberToWords` RETURNS "" ABOVE ITS AUTHORED 10¹² RANGE, and emitting that deleted the
                    // number from the reading with nothing to hear — the fleet's 2^53 defect one magnitude down
                    // (docs/investigations/bignum_fallback_investigation.md). Fall back to digit-at-a-time.
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
