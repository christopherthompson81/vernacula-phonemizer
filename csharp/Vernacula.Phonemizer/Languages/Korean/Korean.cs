/**
 * Korean (ko) phonemizer — Seoul standard, canonical IPA. Hangul g2p (g2p.ts) with the full
 * cross-syllable sandhi + coda neutralisation; no lexicon. text() tokenizes Hangul words / numbers / punctuation.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Korean;

public static class KoreanPhonemizer
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([가-힣]+)|(\\d+)|([.!?…,;:])", "gu");

    // symbol normalization — Korean: hangul loans through the ordinary engine. The UNITS moved to
    // normalize.ts, which needs them before its range/decimal rules and needs them JOINED to the number
    // (this tier always inserts a space); % and the currency sign stay here, where the shared machinery
    // already places the word after the number, which is also Korean's order.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "곱하기" },
        Percent = new[] { "퍼센트" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "달러" },
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // SYMBOLS FIRST, then normalizeKorean: % and $ have to see plain ASCII digits, and normalize's
            // decimal rule rewrites 1.5 to 일점오, which would leave a following % with no number to attach to.
            Clauses.AssembleClauses(Normalize.NormalizeKorean(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(G2p.PhonemizeWord(m.Groups[1].Value));
                // ⚠ ABOVE 2^53 THIS USED TO EMIT NOTHING — `numberToWords` returns "" for an integer whose low
                // digits the float has already lost (composing it would be confidently WRONG), and "" went
                // straight to the sink, so the NUMBER was deleted from the reading. The refusal is right; the
                // else was missing. Digit-at-a-time is what normalize.ts already gives a decimal tail.
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
