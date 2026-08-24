/**
 * Turkish grapheme→phoneme engine.
 * Ported from src/languages/turkish/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkish;

public sealed class Seg
{
    public required string Ph { get; set; } // IPA phoneme(s)
    public required bool Nucleus { get; init; } // is a syllable nucleus (a vowel)
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.Vowels.Ipa;
    private static readonly IReadOnlySet<string> FRONT = new HashSet<string>(Manifest.MANIFEST.Vowels.Front, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> FRONT_UNROUND = new HashSet<string>(Manifest.MANIFEST.Vowels.FrontUnround, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> BACK = new HashSet<string>(Manifest.MANIFEST.Vowels.Back, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> CONS_IPA => Manifest.MANIFEST.Consonants;
    private static readonly IReadOnlySet<string> GEMINATE = new HashSet<string>(Manifest.MANIFEST.Geminate, StringComparer.Ordinal);
    private static bool IsVowel(string c) => c != "" && VOWEL_IPA.ContainsKey(c);

    private static readonly JsRe DOTTED_I = JsRegex.Compile("İ", "g");
    private static readonly JsRe DOTLESS_I = JsRegex.Compile("I", "g");
    private static readonly JsRe CIRCUMFLEX = JsRegex.Compile("[âîû]", "g");

    /** Turkish-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i), then fold â/î/û→a/i/u. */
    public static string TrLower(string word)
    {
        var s = JsRegex.Replace(word, DOTTED_I, _ => "i");
        s = JsRegex.Replace(s, DOTLESS_I, _ => "ı");
        s = s.ToLowerInvariant();
        return JsRegex.Replace(s, CIRCUMFLEX, m => Manifest.MANIFEST.CircumflexFold.GetValueOrDefault(m.Value) ?? m.Value);
    }

    /** Turkish word → segment list. */
    public static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(TrLower(word));
        var segs = new List<Seg>();
        var prevVowel = ""; // last vowel LETTER seen (for l-darkness / ğ)
        var gMerge = "";    // a ğ just lengthened this vowel letter; a following same vowel merges
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var next = i + 1 < chars.Count ? chars[i + 1] : "";
            var prevC = i - 1 >= 0 ? chars[i - 1] : "";
            if (VOWEL_IPA.TryGetValue(c, out var vIpa))
            {
                if (gMerge == c && c != "ı")
                {
                    gMerge = "";
                    prevVowel = c;
                    continue;
                } // ğ-merge: identical vowel folds (ı never merges: yaptığı→ɯːɯ)
                gMerge = "";
                segs.Add(new Seg { Ph = vIpa, Nucleus = true });
                prevVowel = c;
                continue;
            }
            gMerge = "";
            if (c == prevC && GEMINATE.Contains(c))
            {
                segs.Add(new Seg { Ph = "ː", Nucleus = false });
                continue;
            }
            if (c == "ğ")
            {
                if (FRONT_UNROUND.Contains(prevVowel))
                    segs.Add(new Seg { Ph = "j", Nucleus = false }); // değil → dejil
                else if (segs.Count > 0)
                {
                    segs[^1].Ph += "ː";
                    gMerge = prevVowel;
                } // lengthen prev vowel
                continue;
            }
            if (c == "l")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = BACK.Contains(ctx) ? "ɫ" : "l", Nucleus = false });
                continue;
            }
            if (c == "k")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = FRONT.Contains(ctx) ? "c" : "k", Nucleus = false });
                continue;
            }
            if (c == "g")
            {
                var ctx = IsVowel(next) ? next : prevVowel;
                segs.Add(new Seg { Ph = FRONT.Contains(ctx) ? "ɟ" : "ɡ", Nucleus = false });
                continue;
            }
            if (CONS_IPA.TryGetValue(c, out var cons)) segs.Add(new Seg { Ph = cons, Nucleus = false });
        }
        for (var i = 0; i < segs.Count - 1; i++)
        {
            if (segs[i].Ph != "n") continue;
            var nx = segs[i + 1].Ph;
            if (nx == "k" || nx == "ɡ") segs[i].Ph = "ŋ";
            else if (nx == "c" || nx == "ɟ") segs[i].Ph = "ɲ";
        }
        return segs;
    }
}
