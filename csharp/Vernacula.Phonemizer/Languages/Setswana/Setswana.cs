/**
 * Setswana / Tswana (tn) phonemizer — Bantu (Sotho-Tswana, S31), Latin orthography, canonical IPA. A pure
 * greedy longest-match scan over the grapheme table: Setswana is open CV with the syllabic-nasal clusters as
 * onset units, so no coda or syllabification logic is needed. Tone is lexical, unwritten and DEFERRED.
 * Ported from src/languages/setswana/setswana.ts — see that file, and the manifest, for the sourcing of the
 * symbol tier's every field.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Setswana;

public static class SetswanaPhonemizer
{
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** Phonemize a single Setswana word to canonical IPA (segmental; no tone). */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(word);
        var outp = new System.Text.StringBuilder();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var key in Manifest.GRAPHEME_KEYS)
            {
                if (i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0)
                {
                    outp.Append(G[key]);
                    i += key.Length;
                    matched = true;
                    break;
                }
            }
            // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound. Consulted only on
            // the MISS branch, after every grapheme has been tried.
            if (!matched)
            {
                outp.Append(LatinPhones.LatinPhone(w[i].ToString(), new PhoneOpts { Initial = i == 0, IncludeH = true }) ?? "");
                i++;
            }
        }
        return outp.ToString();
    }

    // A word (Setswana letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a different question from TOKEN's script boundary above. */
    private const string NATIVE_CLASS = "[a-zšêô]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    /** The shared symbol tier's Setswana data. ⚠ EVERY NOUN CARRIES ITS CONCORD COPULA, and that is data:
     *  all 51 measure-noun occurrences in the artifact are followed by one and there are ZERO bare measure
     *  nouns beside a digit. Index 0 is the bare citation form (what a standalone symbol emits, where a
     *  dangling copula would be ungrammatical); index 1 is the counted form. See the TS for every field's
     *  attestation, including why `€` and `R` are absent here and `m³` is its own key. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "mo lekgolong" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "didolara", "didolara di le" },
            ["$"] = new[] { "didolara", "didolara di le" },
            ["£"] = new[] { "diponto", "diponto di le" },
            ["P"] = new[] { "dipula", "dipula di le" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["m³"] = new[] { "dikhubikimitara", "dikhubikimitara di le" },
            ["m3"] = new[] { "dikhubikimitara", "dikhubikimitara di le" },
            ["km"] = new[] { "dikilometara", "dikilometara di le" },
            ["mm"] = new[] { "dimilimetara", "dimilimetara di le" },
            ["cm"] = new[] { "disentimetara", "disentimetara di le" },
            ["kg"] = new[] { "dikilogerama", "dikilogerama di le" },
            ["ha"] = new[] { "diheketara", "diheketara di le" },
            ["mi"] = new[] { "dimaele", "dimaele di le" },
            // ⚠ THE ONE-LETTER KEY, and the standing hazard. Its version-dot exposure is closed by ORDER:
            // this layer's decimal rule runs AFTER the tier, so `NOT_VERSION` still has its dot to reject.
            ["m"] = new[] { "dimetara", "dimetara di le" },
        },
        UnitPer = "ka",
        /** Denominator-only, never standalone — a bare `76s` must not become "76 seconds". */
        RateDenominators = new Dictionary<string, string> { ["h"] = "ura", ["s"] = "motsotswana" },
        /** ⚠ POSITION IS `before`, and the commoner (postposed) order is the one the tier cannot say.
         *  ⚠ `cubed` is deliberately absent — see the `m³` keys. */
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "sekwere sa" }, Position = ExponentPosition.Before,
        },
        /** The measure noun HEADS its phrase in Setswana, and the currency noun with it. */
        UnitPrefix = true,
        CurrencyPrefix = true,
        // ⚠ NO `Magnitudes`, and the trade was counted: declaring them buys ONE reading and costs 24, since
        // with CurrencyPrefix the magnitude is dragged in front of its own number.
        Ampersand = Manifest.MANIFEST.Numbers.And,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            return Clauses.AssembleClauses(
                Normalize.NormalizeSetswanaPost(SYMBOLS(Normalize.NormalizeSetswanaPre(input))), TOKEN, (m, sink) =>
                {
                    if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                        sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                    else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    {
                        var tok = m.Groups[2].Value;
                        foreach (var wd in Numbers.NumberToWords(Js.Number(tok), tok).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    }
                    else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    {
                        if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                    }
                });
        }
    }

    /** Build the Setswana phonemizer (greedy rule g2p; tone deferred). */
    public static ILanguage CreateSetswana() => new Engine();

    internal static void RegisterSelf() => Registry.Register("setswana", () => CreateSetswana());
}
