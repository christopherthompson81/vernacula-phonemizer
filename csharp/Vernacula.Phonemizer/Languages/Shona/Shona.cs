/**
 * Shona / chiShona (sn) phonemizer — Bantu (S10, Standard Zezuru), Latin orthography, canonical IPA. A pure
 * greedy longest-match scan over the grapheme table; open CV with a prenasalized cluster as a single onset
 * unit, so no coda or syllabification logic is needed. Tone is unwritten → DEFERRED (segmental only).
 * Ported from src/languages/shona/shona.ts — see that file for the corpus evidence behind every
 * symbol-tier declaration and for the fields deliberately withheld (`magnitudes`, `£`, `ampersand`).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Shona;

public sealed class ShonaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "gu");

    /** One Shona word → canonical IPA (segmental; no tone). */
    public static string PhonemizeWord(string word)
    {
        // The typographic apostrophe is folded here rather than at the call site so the ⟨ng'⟩→[ŋ] grapheme
        // matches regardless of entry point — the eval calls this directly, not via Text().
        var w = CURLY_APOSTROPHE.Replace(Js.ToLowerCase(word), "'");
        var outp = new StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (i <= w.Length - key.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // Consulted only on the MISS branch, after every grapheme has been tried: a letter with no rule
            // here still denotes a sound, and dropping it deletes what the writer typed.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outp.ToString();
    }

    // A word (Shona letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token it rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-z'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /** The shared symbol tier. Every word is a corpus or sn.wikipedia token read in its own slot — see the
     *  TS for the per-key attestation, for why `US$` needs its own key, and for the withheld fields. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "pazana" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably,
        // so `US$` must be declared before `$`.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "madhora" }, ["$"] = new[] { "madhora" },
        },
        CurrencyPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "makiromita" }, ["m"] = new[] { "mamita" }, ["cm"] = new[] { "masendimita" },
            ["mm"] = new[] { "mamirimita" }, ["kg"] = new[] { "makirogiramu" }, ["t"] = new[] { "matani" },
            ["ha"] = new[] { "hekita" },
            // ⚠ `hr`/`hrs` ARE DELIBERATELY NOT HERE although the hour IS read — see Normalize step 7b.
            ["l"] = new[] { "rita" }, ["L"] = new[] { "rita" },
        },
        UnitPrefix = true,
        UnitPer = "pa",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "awa", ["hr"] = "awa", ["hrs"] = "awa", ["s"] = "sekondi", ["min"] = "mineti",
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "maskweya" }, Position = ExponentPosition.Before },
        Multiply = new MultiplyDef { Times = "kuwanzana ne" },
    });

    public string Text(string input) =>
        // ⚠ RULES ON BOTH SIDES OF THE TIER — the Kinyarwanda shape. Ranges and de-grouping have to reach
        // the tier already rewritten (Shona writes the unit after the SECOND operand of a range); the
        // decimal spell-out and the class-6 concord pass have to follow it.
        Clauses.AssembleClauses(
            Normalize.NormalizeShonaPost(SYMBOLS(Normalize.NormalizeShonaPre(input))), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
                }
            });

    /** Build the Shona phonemizer (greedy rule g2p; tone deferred). */
    public static ILanguage CreateShona() => new ShonaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("shona", CreateShona);
}
