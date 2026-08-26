/**
 * Azerbaijani grapheme→phoneme engine — a shallow left-to-right scan (vowel harmony is already spelled),
 * differing from the Turkish sibling in ğ→ɣ, x→x, q→ɡ/word-final x, and the ⟨ə⟩ front vowel.
 * Ported from src/languages/azerbaijani/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Azerbaijani;

public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; init; }
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.Vowels.Ipa;
    private static readonly IReadOnlySet<string> FRONT = new HashSet<string>(Manifest.MANIFEST.Vowels.Front, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> BACK = new HashSet<string>(Manifest.MANIFEST.Vowels.Back, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> CONS_IPA => Manifest.MANIFEST.Consonants;
    private static readonly IReadOnlySet<string> GEMINATE = new HashSet<string>(Manifest.MANIFEST.Geminate, StringComparer.Ordinal);
    private static bool IsVowel(string c) => c != "" && VOWEL_IPA.ContainsKey(c);

    private static readonly JsRe DOTTED_I = JsRegex.Compile("İ", "g");
    private static readonly JsRe DOTLESS_I = JsRegex.Compile("I", "g");

    /** Azerbaijani-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). */
    public static string AzLower(string word)
    {
        var s = JsRegex.Replace(word, DOTTED_I, _ => "i");
        s = JsRegex.Replace(s, DOTLESS_I, _ => "ı");
        return Js.ToLowerCase(s);
    }

    /** Azerbaijani word → segment list. */
    public static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(AzLower(word));
        var segs = new List<Seg>();
        var prevVowel = ""; // last vowel LETTER seen (for l-darkness)
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var next = i + 1 < chars.Count ? chars[i + 1] : "";
            var prevC = i - 1 >= 0 ? chars[i - 1] : "";
            var wordFinal = i == chars.Count - 1;

            if (VOWEL_IPA.TryGetValue(c, out var vIpa))
            {
                segs.Add(new Seg { Ph = vIpa, Nucleus = true });
                prevVowel = c;
                continue;
            }
            if (c == prevC && GEMINATE.Contains(c))
            {
                segs.Add(new Seg { Ph = "ː", Nucleus = false });
                continue;
            }
            if (c == "ğ")
            {
                segs.Add(new Seg { Ph = "ɣ", Nucleus = false });
                continue;
            }
            if (c == "x")
            {
                segs.Add(new Seg { Ph = "x", Nucleus = false });
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
                segs.Add(new Seg { Ph = "ɟ", Nucleus = false });
                continue;
            }
            if (c == "q")
            {
                segs.Add(new Seg { Ph = wordFinal ? "x" : "ɡ", Nucleus = false });
                continue;
            }
            var cons = CONS_IPA.TryGetValue(c, out var mapped)
                ? mapped
                : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (cons is not null) segs.Add(new Seg { Ph = cons, Nucleus = false });
        }
        // Nasal PLACE assimilation.
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
