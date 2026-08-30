/**
 * Aragonese (an) phonemizer — aragonés, Ibero-Romance (Pyrenean), Latin script, canonical IPA.
 * A Spanish-shaped shallow greedy scan with the Aragonese hallmarks: ⟨ch⟩→[t͡ʃ], ⟨ny⟩→[ɲ], ⟨x⟩→[ʃ],
 * ⟨v⟩→[b] (betacism), the distinción (⟨z c⟩+e/i → [θ], ⟨j g⟩+e/i → [x]), the rising glides, and the
 * word-final ⟨-r⟩ apocope. Stress and spirantization are folded/deferred.
 * Ported from src/languages/aragonese/aragonese.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aragonese;

public static class AragonesePhonemizer
{
    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> G => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly IReadOnlySet<string> VOWEL_LETTER =
        new HashSet<string>(Manifest.MANIFEST.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FRONT_LETTER =
        new HashSet<string>(Manifest.MANIFEST.FrontLetters, StringComparer.Ordinal);

    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** Scan a lowercased Aragonese word into IPA phone tokens. */
    private static List<string> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var outp = new List<string>();
        var i = 0;
        while (i < w.Length)
        {
            string c = w[i].ToString(), next = At(w, i + 1);
            var matched = false;
            foreach (var key in Manifest.DIGRAPH_KEYS)
            {
                if (!StartsWithAt(w, key, i)) continue;
                outp.Add(DIGRAPHS[key]);
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            // ⟨qu gu⟩ → [k ɡ] before a front vowel (⟨u⟩ silent); ⟨gu gü / qu⟩ → [kw ɡw] before a back vowel.
            if ((c == "q" || c == "g") && (next == "u" || next == "ü") && VOWEL_LETTER.Contains(At(w, i + 2)))
            {
                var bas = c == "q" ? "k" : "ɡ";
                outp.Add(next == "ü" || !FRONT_LETTER.Contains(At(w, i + 2)) ? bas + "w" : bas);
                i += 2;
                continue;
            }
            if (c == "c") { outp.Add(FRONT_LETTER.Contains(next) ? "θ" : "k"); i += 1; continue; } // distinción: c+e/i → [θ]
            if (c == "g") { outp.Add(FRONT_LETTER.Contains(next) ? "x" : "ɡ"); i += 1; continue; } // g+e/i → [x] (jota)
            // the RISING glides: ⟨i⟩→[j], ⟨u⟩→[w] before another vowel.
            if (c == "i" && VOWEL_LETTER.Contains(next)) { outp.Add("j"); i += 1; continue; }
            if (c == "u" && VOWEL_LETTER.Contains(next)) { outp.Add("w"); i += 1; continue; }
            // ⟨y⟩ → [ʝ] as an onset (before a vowel), [i] as a coda offglide (rey→rei).
            if (c == "y") { outp.Add(VOWEL_LETTER.Contains(next) ? "ʝ" : "i"); i += 1; continue; }
            // word-initial ⟨r⟩ → [r] trill (single ⟨r⟩ is the tap [ɾ] via the table; ⟨rr⟩ is the digraph above).
            if (c == "r" && i == 0) { outp.Add("r"); i += 1; continue; }
            // A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
            var ph = G.TryGetValue(c, out var g) ? g : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0 });
            if (ph is not null && ph != "") outp.Add(ph);
            i += 1;
        }
        // WORD-FINAL ⟨-r⟩ APOCOPE: a final tap [ɾ] after a vowel is dropped (the documented Aragonese trait).
        if (outp.Count >= 2 && outp[^1] == "ɾ" && Ipa.IPA_VOWEL.Contains(outp[^2])) outp.RemoveAt(outp.Count - 1);
        return outp;
    }

    /** ⟨n⟩ → [m] before a labial [b p m] (⟨v⟩ is already [b]). */
    private static void LabialNasal(List<string> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i] == "n" && (toks[i + 1] == "b" || toks[i + 1] == "p" || toks[i + 1] == "m")) toks[i] = "m";
    }

    /** Phonemize a single Aragonese word to canonical IPA (segmental; stress + spirantization folded/deferred). */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        LabialNasal(toks);
        return string.Concat(toks);
    }

    /**
     * The shared SYMBOL tier. `US$` is its own key (or the sign is silently dropped); the percent word is
     * `por cient`; the currency is written in both orders (the spoken order is still noun-last); `hab` is
     * declared as a unit only so `hab/km²` composes as a rate. See the TS for the sourcing.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "por cient" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dólar estausunidense", "dólars estausunidenses" },
            ["€"] = new[] { "euro", "euros" },
            ["£"] = new[] { "libra", "libras" },
            ["$"] = new[] { "dólar", "dólars" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometro", "kilometros" },
            ["m"] = new[] { "metro", "metros" },
            ["cm"] = new[] { "centimetro", "centimetros" },
            ["mm"] = new[] { "milimetro", "milimetros" },
            ["kg"] = new[] { "kilogramo", "kilogramos" },
            ["g"] = new[] { "gramo", "gramos" },
            ["hab"] = new[] { "habitant", "habitants" },
            ["habitants"] = new[] { "habitant", "habitants" },
        },
        UnitPer = "por",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["h"] = "ora" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cuadrau", "cuadraus" },
            Cubed = new[] { "cubico", "cubicos" },
            Position = "after",
        },
        Ampersand = "y",
        Magnitudes = new[] { "millón", "millons", "billón", "billons" },
        MagnitudeConnective = "de",
    });

    // A word (Aragonese Latin letters incl. ñ, accents, ü) / number / punctuation token. The decimal comma
    // is spanned by the number branch, or the tokenizer's own `,` claims it as a clause pause.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'·")})|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
     * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter
     * the language does not use, i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zñáéíóúüïA-ZÑÁÉÍÓÚÜÏ'·]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST — its separator, era, abbreviation, clock and degree steps need the figure
            // and its mark still adjacent — then the shared symbol tier, which matches a unit only when a
            // NUMBER is adjacent.
            return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeAragonese(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // A digit run reads as Aragonese number WORDS, each phonemized like any other word.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    var intPart = bits[0];
                    string? frac = bits.Length > 1 ? bits[1] : null;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (frac is not null)
                    {
                        sink.Emit(PhonemizeWord("coma"));
                        foreach (var dg in frac)
                            foreach (var wd in Numbers.NumberToWords(Js.Number(dg.ToString()), dg.ToString()).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Aragonese phonemizer (Spanish-shaped Ibero-Romance g2p + ch/ny/x deltas + final-r drop). */
    public static ILanguage CreateAragonese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("aragonese", CreateAragonese);
}
