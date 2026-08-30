/**
 * Faroese (fo) phonemizer — a greedy grapheme scan whose CORE rule is that vowel LENGTH conditions vowel
 * QUALITY. This file owns the machinery: the open/closed length computation on the stressed vowel, the
 * SKERPING application sites, and the consonant passes (ð/g deletion with glide choice, g/k affrication,
 * retroflex r-clusters, ll→tl, v-vocalization, hv/hj). The grapheme values, skerping remaps and the data
 * live in faroese.jsonc.
 * Ported from src/languages/faroese/faroese.ts — see that file for the corpus evidence and the
 * orthographic notes.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Faroese;

public static class FaroesePhonemizer
{
    private sealed class Seg
    {
        public string G;
        public string Ph;
        public bool Vowel;
        public bool Stressed;
        public bool Long;
        public Seg(string g, string ph, bool vowel)
        {
            G = g;
            Ph = ph;
            Vowel = vowel;
        }
    }

    private static IReadOnlyDictionary<string, string[]> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> SKERP => Manifest.MANIFEST.Skerping;
    private static IReadOnlyDictionary<string, string> SKERP_GGJ => Manifest.MANIFEST.SkerpingGgj;
    private static IReadOnlyDictionary<string, string> PRENASAL => Manifest.MANIFEST.Prenasal;

    /** Scan a lowercased Faroese word into vowel/consonant segments (greedy, vowel digraphs first). */
    private static List<Seg> Scan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var segs = new List<Seg>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var k in Manifest.VOWEL_KEYS)
            {
                if (w.AsSpan(i).StartsWith(k, StringComparison.Ordinal))
                {
                    segs.Add(new Seg(k, "", true));
                    i += k.Length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            var c = w[i].ToString();
            segs.Add(new Seg(c, CONS.GetValueOrDefault(c, ""), false));
            i += 1;
        }
        return segs;
    }

    /** One Faroese word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(word);
        // Stress = the first vowel (Faroese has fixed initial stress).
        var firstV = -1;
        for (var i = 0; i < segs.Count; i++)
            if (segs[i].Vowel) { firstV = i; break; }
        if (firstV >= 0)
        {
            segs[firstV].Stressed = true;
            // LENGTH: count consonant segments between the stressed vowel and the next vowel (or word end).
            // Long if ≤1 (open syllable), short if ≥2 (closed). ⟨ð⟩ is silent → doesn't close the syllable.
            var nCons = 0;
            for (var k = firstV + 1; k < segs.Count; k++)
            {
                if (segs[k].Vowel) break;
                if (segs[k].G == "ð") continue;
                nCons++;
            }
            segs[firstV].Long = nCons <= 1;
        }
        // Assign vowel qualities: the stressed vowel by its length; every other vowel takes the SHORT
        // quality (unstressed).
        foreach (var s in segs)
        {
            if (!s.Vowel) continue;
            var pair = VOWEL[s.G];
            s.Ph = s.Stressed && s.Long ? pair[0] : pair[1];
        }
        // ⚠ SKERPING: a vowel before ⟨gv⟩ raises/shortens; before ⟨ggj⟩ the í/ý offglide drops.
        for (var k = 0; k < segs.Count - 2; k++)
        {
            var v = segs[k];
            if (!v.Vowel) continue;
            var g1 = segs[k + 1].G;
            var g2 = segs[k + 2].G;
            if (g1 == "g" && g2 == "v") v.Ph = SKERP.GetValueOrDefault(v.G, v.Ph);
            else if (g1 == "g" && g2 == "g") v.Ph = SKERP_GGJ.GetValueOrDefault(v.G, v.Ph);
        }
        ConsonantPasses(segs);
        NasalPass(segs);
        var sb = new StringBuilder();
        foreach (var s in segs)
            if (s.Ph != "") sb.Append(s.Ph);
        return sb.ToString();
    }

    private static bool IsV(Seg? s) => s is not null && s.Vowel;

    // The glide an intervocalic ⟨g ð⟩ becomes, decided by the surrounding vowels: [j] if EITHER neighbour
    // is front, else [v] if either is round, else deleted (front wins over round when the two disagree).
    private static string GdGlide(Seg? prev, Seg? next)
    {
        foreach (var s in new[] { prev, next })
            if (s is not null && s.Vowel && Manifest.FRONT_GLIDE.Contains(s.G)) return "j";
        foreach (var s in new[] { prev, next })
            if (s is not null && s.Vowel && Manifest.ROUND_GLIDE.Contains(s.G)) return "v";
        return "";
    }

    private static readonly Dictionary<string, string> RETRO = new(StringComparer.Ordinal)
    {
        ["n"] = "ɳ", ["t"] = "ʈ", ["d"] = "ɖ", ["s"] = "ʂ", ["l"] = "ɭ",
    };

    /** The context-sensitive consonant rules, applied left-to-right over the scanned segments. */
    private static void ConsonantPasses(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.Vowel) continue;
            var g = s.G;
            var prev = i > 0 ? segs[i - 1] : null;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            // GEMINATE collapse: a doubled consonant → a single phone (the length is folded). The two
            // segments were kept through the length count (so a geminate correctly closes the syllable).
            if (next is not null && next.G == g)
            {
                if (g == "l") { s.Ph = "t"; next.Ph = "l"; continue; } // ⟨ll⟩ → [tl]
                var after = i + 2 < segs.Count ? segs[i + 2] : null;
                // ⟨gg kk⟩ before a front vowel / ⟨j⟩ → the affricate [t͡ʃ].
                if ((g == "g" || g == "k") && after is not null
                    && (after.Vowel ? Manifest.FRONT_V.Contains(after.G) : after.G == "j"))
                {
                    s.Ph = "t͡ʃ"; next.Ph = ""; next.G = "";
                    if (after.G == "j") { after.Ph = ""; after.G = ""; }
                    continue;
                }
                s.Ph = CONS.GetValueOrDefault(g, s.Ph); next.Ph = ""; next.G = "";
                continue;
            }
            // ⟨hv⟩ → [kv]; ⟨hj⟩ → [j] (the [j] comes from the ⟨j⟩); a plain ⟨h⟩ stays [h].
            if (g == "h" && next is not null && next.G == "v") { s.Ph = "k"; continue; }
            if (g == "h" && next is not null && next.G == "j") { s.Ph = ""; continue; }
            // Consonant + ⟨j⟩ palatal digraphs: ⟨tj⟩→[t͡ʃ], ⟨dj⟩→[d͡ʒ], ⟨sj⟩→[ʃ] — the ⟨j⟩ is absorbed.
            if (next is not null && next.G == "j" && (g == "t" || g == "d" || g == "s"))
            {
                s.Ph = g == "t" ? "t͡ʃ" : g == "d" ? "d͡ʒ" : "ʃ";
                next.Ph = ""; next.G = "";
                continue;
            }
            // ⟨g k⟩ → [t͡ʃ] before a FRONT vowel — but an INTERVOCALIC ⟨g⟩ is the glide instead.
            if ((g == "g" || g == "k") && !(g == "g" && IsV(prev) && IsV(next)))
            {
                var fv = next is not null && (next.Vowel ? Manifest.FRONT_V.Contains(next.G) : next.G == "j");
                if (fv)
                {
                    s.Ph = "t͡ʃ";
                    if (next is not null && next.G == "j") next.Ph = "";
                    continue;
                }
            }
            // Intervocalic ⟨ð⟩ / ⟨g⟩ → the [j]/[v]/∅ glide by the surrounding vowels.
            if (g == "ð") { s.Ph = IsV(prev) && IsV(next) ? GdGlide(prev, next) : ""; continue; }
            if (g == "g" && IsV(prev) && IsV(next)) { s.Ph = GdGlide(prev, next); continue; }
            // ⟨v⟩ → [u] before a consonant (forms a diphthong); [v] intervocalic / onset.
            if (g == "v" && IsV(prev) && next is not null && !next.Vowel) { s.Ph = "u"; continue; }
            // Retroflex r-clusters: ⟨r⟩ + coronal → retroflex, and the coronal retroflexes too.
            if (g == "r" && next is not null)
            {
                if (RETRO.TryGetValue(next.G, out var rp)) { s.Ph = "ɻ"; next.Ph = rp; continue; }
                s.Ph = "ɹ"; continue;
            }
            if (g == "r") { s.Ph = "ɹ"; continue; }
            // Word-final unstressed ⟨-um⟩ → [ʊn]: the inflectional -um ending, gated on ⟨u⟩.
            if (g == "m" && i == segs.Count - 1 && prev is not null && prev.G == "u" && !prev.Stressed)
            {
                s.Ph = "n"; continue;
            }
        }
    }

    /** ⟨ng nk⟩: ⟨n⟩ → [ŋ] before a velar [k], → [ɲ] before the palatal affricate; the preceding short
     *  vowel shifts (a→[ɛ]). Runs on the emitted phones (after affrication). */
    private static void NasalPass(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
        {
            if (segs[i].Ph != "n") continue;
            var nph = segs[i + 1].Ph;
            if (nph == "k" || nph == "t͡ʃ")
            {
                segs[i].Ph = nph == "t͡ʃ" ? "ɲ" : "ŋ";
                var prev = i > 0 ? segs[i - 1] : null;
                if (prev is not null && prev.Vowel && PRENASAL.TryGetValue(prev.G, out var p)) prev.Ph = p;
            }
        }
    }

    /**
     * The shared SYMBOL tier. ⚠ THE CURRENCY IS POSTPOSED AND ABBREVIATED `kr.`, which the normalizer
     * does NOT expand: the tier's own key reads it, and expanding it there first would leave the tier
     * with a word it does not match.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "prosent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["kr"] = new[] { "króna", "krónur" },
            ["$"] = new[] { "dollari", "dollarar" },
            ["€"] = new[] { "evra", "evrur" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometur", "kilometrar" },
            ["m"] = new[] { "metur", "metrar" },
            ["cm"] = new[] { "sentimetur", "sentimetrar" },
            ["mm"] = new[] { "millimetur", "millimetrar" },
            ["kg"] = new[] { "kilogramm", "kilogrommum" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "fervent" },
            Cubed = new[] { "teningsmát" },
            Position = ExponentPosition.After,
        },
        Ampersand = "og",
        Magnitudes = new[] { "túsund", "milliónir", "miljardir" },
    });

    // A word (Faroese Latin letters incl. á í ó ú ý æ ø ð) / number / punctuation token.
    // ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a
    // clause pause and `6,3°C` reads as a phrase break inside a quantity.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'-")})|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /** This language's OWN inventory: a token the class rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-záíóúýæøðþA-ZÁÍÓÚÝÆØÐÞ'-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST — the degree and range steps need the figure and its mark still adjacent,
            // which the tier would break.
            var prepared = SYMBOLS(Normalize.NormalizeFaroese(input));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    var intPart = bits[0];
                    // ⚠ `intPart`, NOT the whole match, IS THE `raw` (#1080): this arm's match carries the
                    // DECIMAL COMMA, so handing the whole match would read the fraction's digits into the integer.
                    foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                    if (bits.Length > 1)
                    {
                        // `komma` — the separator's own name; the fractional part is read digit by digit.
                        sink.Emit(PhonemizeWord("komma"));
                        foreach (var ch in bits[1])
                            foreach (var wd in Numbers.NumberToWords(Js.Number(ch.ToString())).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Faroese phonemizer (length-conditioned vowel quality + the deep-orthography consonant rules). */
    public static ILanguage CreateFaroese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("faroese", CreateFaroese);
}
