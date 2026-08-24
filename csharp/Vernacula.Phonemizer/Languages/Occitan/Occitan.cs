/**
 * Occitan (oc) phonemizer — occitan / lenga d'òc, Occitano-Romance (Gallo-Romance), Latin script, canonical
 * IPA, targeting LANGUEDOCIEN (the central reference standard): a greedy longest-match grapheme scan plus
 * code rules for softening, the ⟨u⟩ glide and Languedocien final-consonant deletion.
 * Ported from src/languages/occitan/occitan.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Occitan;

public sealed class OccitanDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Graphemes { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IReadOnlyList<string> VoicelessPhones { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> VowelLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> FrontLetters { get; init; } = Array.Empty<string>();
    public OccitanNumbers Numbers { get; init; } = new();
}

public sealed class OccitanPhonemizer : ILanguage
{
    internal static readonly OccitanDef DEF = LoadManifest.Load<OccitanDef>("languages/occitan", "occitan.jsonc");
    private static IReadOnlyDictionary<string, string> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> G => DEF.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly List<string> ORDER = DEF.Digraphs.Keys.OrderByDescending(k => k.Length).ToList();
    private static readonly IReadOnlySet<string> VOWEL_LETTER = new HashSet<string>(DEF.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FRONT_LETTER = new HashSet<string>(DEF.FrontLetters, StringComparer.Ordinal);
    private static IReadOnlySet<string> VOWEL_PH => Ipa.IPA_VOWEL; // IPA vowel heads

    /** One scan token: the IPA phones for a grapheme + a flag marking a single ⟨s⟩ that may voice to [z]. */
    private sealed class Tok
    {
        public required string Ph { get; set; }
        public bool SVar { get; init; }
    }

    private static bool StartsWithAt(string w, string key, int i) =>
        i + key.Length <= w.Length && string.CompareOrdinal(w, i, key, 0, key.Length) == 0;

    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /**
     * Scan a lowercased Occitan word into phone tokens: digraphs, ⟨qu gu⟩, ⟨c g⟩ softening, ⟨u⟩→[w] offglide.
     */
    private static List<Tok> Scan(string word)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var toks = new List<Tok>();
        var i = 0;
        while (i < w.Length)
        {
            string c = w[i].ToString(), next = At(w, i + 1);
            var matched = false;
            foreach (var key in ORDER)
            {
                if (!StartsWithAt(w, key, i)) continue;
                toks.Add(new Tok { Ph = DIGRAPHS[key] });
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            if ((c == "q" || c == "g") && next == "u" && VOWEL_LETTER.Contains(At(w, i + 2)))
            {
                var bas = c == "q" ? "k" : "ɡ";
                toks.Add(new Tok { Ph = FRONT_LETTER.Contains(At(w, i + 2)) ? bas : bas + "w" });
                i += 2;
                continue;
            }
            if (c == "c") { toks.Add(new Tok { Ph = FRONT_LETTER.Contains(next) ? "s" : "k" }); i += 1; continue; }
            if (c == "g") { toks.Add(new Tok { Ph = FRONT_LETTER.Contains(next) ? "d͡ʒ" : "ɡ" }); i += 1; continue; }
            if (c == "u")
            {
                // ⟨u⟩ → [w] only as a FALLING offglide (after a vowel); in hiatus before a vowel it is the
                // nucleus [y], and the rising [w] of ⟨qu gu⟩ was already consumed above.
                toks.Add(new Tok { Ph = VOWEL_LETTER.Contains(At(w, i - 1)) ? "w" : "y" });
                i += 1;
                continue;
            }
            // ⟨i⟩ → [j] before a vowel — but NOT before ⟨u⟩: that is the falling diphthong [iw] (arriu→ariw).
            if (c == "i" && next != "u" && VOWEL_LETTER.Contains(next)) { toks.Add(new Tok { Ph = "j" }); i += 1; continue; }
            if (G.TryGetValue(c, out var ph) && ph != "") toks.Add(new Tok { Ph = ph, SVar = c == "s" });
            i += 1;
        }
        return toks;
    }

    private static bool StartsWithVowel(string ph) => VOWEL_PH.Contains(Js.CodePoints(ph)[0]);
    private static bool EndsWithVowel(string ph)
    {
        var a = Js.CodePoints(ph);
        return VOWEL_PH.Contains(a[^1]);
    }

    private static readonly IReadOnlySet<string> VOICELESS_PH =
        new HashSet<string>(DEF.VoicelessPhones, StringComparer.Ordinal); // + the affricates (tested by their head [t])

    /** Single ⟨s⟩ → [z] before a voiced sound (intervocalic Lisbona→lizbunɔ, or before a voiced consonant); ⟨ss⟩
     *  (already [s]) and coda ⟨s⟩ before a voiceless sound stay [s]. */
    private static void VoiceS(List<Tok> toks)
    {
        for (var i = 1; i < toks.Count; i++)
        {
            var t = toks[i];
            if (!t.SVar || !EndsWithVowel(toks[i - 1].Ph)) continue;
            string? next = i + 1 < toks.Count ? toks[i + 1].Ph : null;
            if (next is not null && !VOICELESS_PH.Contains(Js.CodePoints(next)[0])) t.Ph = "z";
        }
    }

    private static readonly IReadOnlyDictionary<string, string> DEVOICE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["b"] = "p", ["d"] = "t", ["ɡ"] = "k", ["z"] = "s", ["v"] = "f",
    };

    /** Word-final obstruent DEVOICING (Nòrd→nɔɾt). */
    private static void FinalDevoice(List<Tok> toks)
    {
        if (toks.Count > 0 && DEVOICE.TryGetValue(toks[^1].Ph, out var d)) toks[^1].Ph = d;
    }

    /** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ] (Lengadòc→leŋɡ…, Navarrencs→…eŋk…). */
    private static void VelarNasal(List<Tok> toks)
    {
        for (var i = 0; i < toks.Count - 1; i++)
            if (toks[i].Ph == "n" && (toks[i + 1].Ph == "k" || toks[i + 1].Ph == "ɡ")) toks[i].Ph = "ŋ";
    }

    /** Final unstressed ⟨a⟩ → [ɔ] (Languedocien: França→fɾansɔ). Operates on the raw word's last letter. */
    private static void FinalA(string word, List<Tok> toks)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        if (toks.Count > 0 && toks[^1].Ph == "a" && w.EndsWith("a", StringComparison.Ordinal)) toks[^1].Ph = "ɔ";
    }

    /** Word-final ⟨n⟩ / ⟨r⟩ after a vowel DROPS — the Languedocien final-consonant deletion (Japon→dʒapu,
     *  abandonar→abanduna). */
    private static void DropFinalNR(List<Tok> toks)
    {
        var n = toks.Count;
        if (n >= 2 && (toks[n - 1].Ph == "n" || toks[n - 1].Ph == "ɾ") && EndsWithVowel(toks[n - 2].Ph))
            toks.RemoveAt(n - 1);
    }

    /**
     * Phonemize a single Occitan word to canonical IPA (segmental; spirantization + stress folded/deferred).
     */
    public static string PhonemizeWord(string word)
    {
        var toks = Scan(word);
        VoiceS(toks);
        VelarNasal(toks);
        DropFinalNR(toks);
        FinalA(word, toks);
        FinalDevoice(toks);
        return string.Concat(toks.Select(t => t.Ph));
    }

    /** The shared SYMBOL tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "per cent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "èuro", "èuros" }, ["$"] = new[] { "dolar", "dolars" }, ["£"] = new[] { "liura", "liuras" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "quilomètre", "quilomètres" }, ["m"] = new[] { "mètre", "mètres" },
            ["cm"] = new[] { "centimètre", "centimètres" }, ["mm"] = new[] { "millimètre", "millimètres" },
            ["kg"] = new[] { "quilograma", "quilogramas" }, ["ha"] = new[] { "ectara", "ectaras" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "quadrat", "quadrats" },
            Cubed = new[] { "cubic", "cubics" },
            Position = ExponentPosition.After,
        },
        Ampersand = "e",
        Magnitudes = new[] { "milion", "milions", "miliard", "miliards" },
    });

    // ⚠ The number branch must SPAN the decimal comma, or the tokenizer's own `,` claims it as a clause pause
    // and `13,1°C` reads as *tretze , un*. Normalize has already folded the dot decimals onto the comma.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'·-")})|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zàèòáéíóúïüçA-ZÀÈÒÁÉÍÓÚÏÜÇ'·-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        // ⚠ ORDER: Normalize runs FIRST — its separator, era, clock, sign and degree steps need the figure
        // and its mark still adjacent, which the shared symbol tier would break.
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeOccitan(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = m.Groups[2].Value.Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart)).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord("virgula"));
                    foreach (var dg in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(dg.ToString())).Split(' ')) sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /**
     * Build the Occitan phonemizer (Languedocien grapheme g2p + o→u + final-a→ɔ; spirantization/stress
     * folded).
     */
    public static ILanguage CreateOccitan() => new OccitanPhonemizer();

    internal static void RegisterSelf() => Registry.Register("occitan", CreateOccitan);
}
