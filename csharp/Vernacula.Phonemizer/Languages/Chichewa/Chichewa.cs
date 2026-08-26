/**
 * Chichewa / Chinyanja (nya) phonemizer — Bantu (N31), Latin orthography, canonical IPA. A pure greedy
 * longest-match scan over the grapheme table; open CV with prenasalised clusters as single onset units, so
 * no syllabification is needed. Tone is unwritten → DEFERRED (segmental output only).
 * Ported from src/languages/chichewa/chichewa.ts — see that file for the corpus evidence behind every
 * symbol-tier declaration and for the fields deliberately withheld (`magnitudes`, `€`, `ampersand`).
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chichewa;

public sealed class ChichewaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Chichewa word → canonical IPA (segmental; no tone). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
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

    // A word (Chichewa letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token it rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-z'’]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");
    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "gu");

    /** The shared symbol tier. Every word is a corpus or ny.wikipedia token read in its own slot — see the
     *  TS for the per-key attestation and for why `magnitudes`, `€` and `ampersand` are withheld. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "peresenti" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "madola" }, ["£"] = new[] { "mapaundi" },
        },
        CurrencyPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "makilomita" }, ["cm"] = new[] { "sentimita" }, ["mm"] = new[] { "milimita" },
            ["mi"] = new[] { "mailosi" }, ["kg"] = new[] { "makilogalamu" }, ["g"] = new[] { "magalamu" },
            ["l"] = new[] { "malita" }, ["L"] = new[] { "malita" }, ["ha"] = new[] { "mahekitala" },
        },
        UnitPrefix = true,
        UnitPer = "pa",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "ola" },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "sikweya" }, Position = ExponentPosition.Before },
    });

    public string Text(string input) =>
        // ⚠ THE TIER RUNS FIRST AND NormalizeChichewa SECOND — the Swahili order, not the Xhosa one. The
        // decimal spell-out has to happen after a percent/currency/unit word is attached, or the tier sees
        // `66 7 %` with no number beside the sign.
        Clauses.AssembleClauses(Normalize.NormalizeChichewa(SYMBOLS(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(CURLY_APOSTROPHE.Replace(Nat(m.Groups[1].Value), "'")));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                if (!string.IsNullOrEmpty(mk)) sink.Pause(mk);
            }
        });

    /** Build the Chichewa phonemizer (greedy rule g2p; tone deferred). */
    public static ILanguage CreateChichewa() => new ChichewaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("chichewa", CreateChichewa);
}
