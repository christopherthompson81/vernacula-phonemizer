/**
 * Tajik / тоҷикӣ (tg) phonemizer — canonical IPA.
 * Ported from src/languages/tajik/tajik.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public static class TajikPhonemizer
{
    private static TajikManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> VOWEL => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> GLIDE => DEF.Glides;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static readonly IReadOnlySet<string> VOWEL_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.Vowels.Keys, StringComparer.Ordinal);

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Nucleus { get; init; }
    }

    private static readonly JsRe GLIDE_NUCLEUS = JsRegex.Compile("[aɔuiɵe]", "u");

    /** Tajik word → IPA segment list (nucleus flags drive final stress). */
    private static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(word.ToLowerInvariant());
        var segs = new List<Seg>();
        var prevWasVowel = false; // for е→je after a vowel / word-initially
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            if (VOWEL_LETTERS.Contains(c))
            {
                if ((c == "е" || c == "э") && (i == 0 || prevWasVowel))
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                }
                else if ((c == "и" || c == "ӣ") && prevWasVowel)
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                }
                segs.Add(new Seg { Ph = VOWEL[c], Nucleus = true });
                prevWasVowel = true;
                continue;
            }
            if (GLIDE.TryGetValue(c, out var gph))
            {
                var ph = gph;
                if (c == "й")
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                    prevWasVowel = false;
                }
                else
                {
                    foreach (var p in Js.CodePoints(ph))
                        segs.Add(new Seg { Ph = p, Nucleus = GLIDE_NUCLEUS.IsMatch(p) });
                    prevWasVowel = true;
                }
                continue;
            }
            if (CONS.TryGetValue(c, out var cons))
            {
                if (cons != "") segs.Add(new Seg { Ph = cons, Nucleus = false });
                prevWasVowel = false;
            }
        }
        return segs;
    }

    /** One Tajik word → canonical IPA with a single primary-stress mark (Persian final stress). */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        if (segs.Count == 0) return "";
        var nucIdx = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nucIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph)); // consonant-only (abbreviation)
        var stressIdx = nucIdx[^1]; // FINAL stress
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) @out += "ˈ";
            @out += segs[i].Ph;
        }
        return @out;
    }

    private static TajikNumbersDef N => DEF.Numbers;
    /**
     * Compose the Tajik SPELLING of a non-negative integer, then phonemize it (space-separated where
     * appropriate).
     */
    public static string NumberWords(double n)
    {
        if (!double.IsFinite(n) || n < 0) return "";
        if (n == 0) return N.Units[0];
        var parts = new List<string>();
        List<string> Three(double x)
        {
            var p = new List<string>();
            var h = Math.Floor(x / 100);
            var rem = x % 100;
            if (h > 9) return p; // never reachable once the ladder covers the magnitude — a guard, not a branch
            if (h > 0) p.Add(h == 1 ? N.Hundred : N.Units[(int)h] + N.Hundred); // сад / дусад / сесад …
            if (rem >= 10 && rem < 20) p.Add(N.Teens[(int)rem - 10]);
            else
            {
                var t = Math.Floor(rem / 10);
                var u = rem % 10;
                if (t > 0) p.Add(N.Tens[Js.NumberToString(t * 10)]);
                if (u > 0) p.Add(N.Units[(int)u]);
            }
            return p;
        }
        var SCALES = new (double Value, string Word, bool DropOne)[]
        {
            (1_000_000_000_000d, N.Trillion, false),
            (1_000_000_000d, N.Milliard, false),
            (1_000_000d, N.Million, false),
            (1000d, N.Thousand, true),
        };
        var left = n;
        foreach (var (value, word, dropOne) in SCALES)
        {
            var q = Math.Floor(left / value);
            if (q > 0)
            {
                if (!(dropOne && q == 1)) parts.AddRange(Three(q));
                parts.Add(word);
                left %= value;
            }
        }
        if (left > 0) parts.AddRange(Three(left));
        if (parts.Count == 0) return "";
        var MAG = new HashSet<string>(new[] { N.Thousand, N.Million, N.Milliard, N.Trillion }, StringComparer.Ordinal);
        var @out = parts[0];
        for (var i = 1; i < parts.Count; i++)
        {
            @out += (MAG.Contains(parts[i]) ? " " : $"{N.And} ") + parts[i];
        }
        return @out; // space-separated tokens; "бисту" is one token, phonemized bistu
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // ⚠ NORMALIZE FIRST, THEN INITIALISMS: normalize's abbreviation, unit and rate steps must see
            // `МВт`, `км` and `с.` before an all-caps pass could spell them out letter by letter.
            Clauses.AssembleClauses(Normalize.NormalizeTajikInitialisms(Normalize.NormalizeTajik(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var w in NumberWords(Js.Number(m.Groups[2].Value)).Split(' ')) sink.Emit(PhonemizeWord(w));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Tajik phonemizer (Cyrillic near-phonemic g2p; Persian final stress; cardinal numbers). */
    public static ILanguage CreateTajik() => new Engine();

    internal static void RegisterSelf() => Registry.Register("tajik", CreateTajik);
}
